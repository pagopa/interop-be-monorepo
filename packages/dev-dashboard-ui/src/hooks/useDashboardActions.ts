import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type {
  DashboardAction,
  DashboardStatus,
  Operation,
  PresetInput,
} from "../api/dashboard/dashboard.services";

import { DashboardMutations } from "../api/dashboard/dashboard.mutations";
import { DashboardQueries } from "../api/dashboard/dashboard.queries";
import { errorMessage } from "../lib/utils";

export type ActionFailure = {
  kind:
    | "preset.start"
    | "preset.stop"
    | "infra.start"
    | "infra.stop"
    | "infra.reset";
  message: string;
  operationId: string;
};
type TrackedAction = {
  operationId: string;
  kind?: ActionFailure["kind"];
  completed?: boolean;
  failure?: ActionFailure;
};
type TrackedActions = Record<string, TrackedAction>;

function packagePhaseKey(id: string) {
  if (id.startsWith("watch:"))
    return `package-watch:${id.slice("watch:".length)}`;
  const prefix = ["start:", "stop:"].find((value) => id.startsWith(value));
  return prefix ? `package:${id.slice(prefix.length)}` : undefined;
}

function active(operation: Operation) {
  return operation.state === "running" || operation.state === "pending";
}

function deriveBusy(
  status: DashboardStatus | undefined,
  tracked: TrackedActions
) {
  const busy: Record<string, string> = {};
  for (const [key, record] of Object.entries(tracked)) {
    if (record.completed) continue;
    const operation = status?.operations.find(
      (item) => item.id === record.operationId
    );
    if (!operation) {
      busy[key] = record.operationId;
      continue;
    }
    if (!active(operation)) continue;
    if (key.startsWith("package-watch:")) {
      busy[key] = operation.id;
      continue;
    }
    const phases = operation.phases.filter(
      (phase) => packagePhaseKey(phase.id) === key
    );
    if (
      !phases.length ||
      phases.some(
        (phase) => phase.state === "running" || phase.state === "pending"
      )
    )
      busy[key] = operation.id;
  }
  for (const operation of status?.operations ?? []) {
    if (!active(operation)) continue;
    if (operation.kind.startsWith("infra.")) {
      busy.infra ??= operation.id;
      busy[`infra-${operation.kind.slice("infra.".length)}`] ??= operation.id;
    }
    if (operation.kind === "seed") busy.seed ??= operation.id;
    if (operation.kind === "seed.prepare")
      busy["seed-prepare"] ??= operation.id;
    for (const phase of operation.phases) {
      const key = packagePhaseKey(phase.id);
      const watching =
        operation.kind === "package.watch" ||
        operation.kind === "packages.watch";
      if (
        key &&
        ((watching && phase.id.startsWith("watch:")) ||
          phase.state === "running" ||
          phase.state === "pending")
      )
        busy[key] ??= operation.id;
    }
  }
  return busy;
}

function deriveFailures(
  status: DashboardStatus | undefined,
  tracked: TrackedActions
) {
  const failures: Record<string, ActionFailure> = {};
  for (const [key, record] of Object.entries(tracked)) {
    if (!record.kind) continue;
    if (record.failure) {
      failures[key] = record.failure;
      continue;
    }
    const operation = status?.operations.find(
      (item) => item.id === record.operationId
    );
    if (operation?.state !== "failed") continue;
    failures[key] = {
      kind: record.kind,
      operationId: operation.id,
      message:
        operation.error?.trim() ||
        operation.phases
          .find((phase) => phase.state === "failed" && phase.error?.trim())
          ?.error?.trim() ||
        "No failure details were provided.",
    };
  }
  return failures;
}

export function useDashboardActions(
  status: DashboardStatus | undefined,
  refresh: () => Promise<void>
) {
  const client = useQueryClient();
  const runMutation = DashboardMutations.useRunAction();
  const saveMutation = DashboardMutations.useSavePreset();
  const deleteMutation = DashboardMutations.useDeletePreset();
  const [tracked, setTracked] = useState<TrackedActions>({});
  // Ref updates are synchronous so two submissions in the same event cannot acquire the same keys.
  const trackedRef = useRef<TrackedActions>({});
  const [actionError, setActionError] = useState("");
  const busy = deriveBusy(status, tracked);
  const actionFailures = deriveFailures(status, tracked);

  // The backend evicts old operations. Retire accepted requests and retain only their
  // compact failure outcomes before eviction; live busy state is still derived above.
  useEffect(() => {
    const outcomes = deriveFailures(status, tracked);
    let changed = false;
    const next = { ...trackedRef.current };
    for (const [key, record] of Object.entries(tracked)) {
      const operation = status?.operations.find(
        (item) => item.id === record.operationId
      );
      if (
        record.completed ||
        !operation ||
        active(operation) ||
        next[key]?.operationId !== record.operationId
      )
        continue;
      next[key] = { ...record, completed: true, failure: outcomes[key] };
      changed = true;
    }
    if (changed) {
      trackedRef.current = next;
      setTracked(next);
    }
  }, [status, tracked]);

  function updateTracked(next: TrackedActions) {
    trackedRef.current = next;
    setTracked(next);
  }
  function removeKeys(keys: string[]) {
    updateTracked(
      Object.fromEntries(
        Object.entries(trackedRef.current).filter(
          ([key]) => !keys.includes(key)
        )
      )
    );
  }
  function blocked(keys: string[]) {
    const currentBusy = deriveBusy(
      client.getQueryData(DashboardQueries.status().queryKey) ?? status,
      trackedRef.current
    );
    return (
      !keys.length ||
      keys.some((key) => {
        const relatedKey = key.startsWith("package-watch:")
          ? `package:${key.slice("package-watch:".length)}`
          : key.startsWith("package:")
            ? `package-watch:${key.slice("package:".length)}`
            : undefined;
        return Boolean(
          currentBusy[key] || (relatedKey && currentBusy[relatedKey])
        );
      })
    );
  }

  async function runAction(action: DashboardAction, key: string | string[]) {
    const keys = [...new Set(Array.isArray(key) ? key : [key])];
    if (blocked(keys)) return false;
    let failureKey: string | undefined;
    let kind: ActionFailure["kind"] | undefined;
    if (action.type === "preset.start" || action.type === "preset.stop") {
      failureKey = `preset:${action.id}`;
      kind = action.type;
    } else if (
      action.type === "infra.start" ||
      action.type === "infra.stop" ||
      action.type === "infra.reset"
    ) {
      failureKey = "infra";
      kind = action.type;
    }
    const records = Object.fromEntries(
      keys.map((item) => [
        item,
        {
          operationId: "request",
          kind: item === failureKey ? kind : undefined,
        },
      ])
    );
    updateTracked({ ...trackedRef.current, ...records });
    setActionError("");
    try {
      const accepted = await runMutation.mutateAsync(action);
      updateTracked({
        ...trackedRef.current,
        ...Object.fromEntries(
          keys.map((item) => [
            item,
            { ...records[item], operationId: accepted.operationId },
          ])
        ),
      });
      await refresh();
      return true;
    } catch (error) {
      setActionError(errorMessage(error));
      removeKeys(keys);
      return false;
    }
  }

  async function savePreset(input: PresetInput) {
    const key = "preset-editor";
    if (blocked([key])) return false;
    updateTracked({ ...trackedRef.current, [key]: { operationId: "request" } });
    setActionError("");
    try {
      await saveMutation.mutateAsync(input);
      await refresh();
      return true;
    } catch (error) {
      setActionError(errorMessage(error));
      return false;
    } finally {
      removeKeys([key]);
    }
  }

  async function removePreset(id: string) {
    const key = `preset:${id}`;
    if (blocked([key])) return;
    updateTracked({ ...trackedRef.current, [key]: { operationId: "request" } });
    setActionError("");
    try {
      await deleteMutation.mutateAsync(id);
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      removeKeys([key]);
    }
  }

  return {
    actionError,
    actionFailures,
    busy,
    runAction,
    savePreset,
    removePreset,
    dismissError: () => setActionError(""),
  };
}
