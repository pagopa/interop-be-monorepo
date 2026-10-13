import type {
  Operation,
  Package,
} from "pagopa-interop-dev-dashboard-contracts";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DashboardMutations } from "../api/dashboard/dashboard.mutations";
import { DashboardQueries } from "../api/dashboard/dashboard.queries";
import { errorMessage } from "../lib/utils";

export type TokenAction = "seed" | "seed.prepare";
const tokenActions: TokenAction[] = ["seed", "seed.prepare"];
type TrackedAction = { knownIds: Set<string>; operationId?: string };
type Selection = {
  revision: string;
  tenantKey?: string;
  userId?: string;
  token?: string;
  copied?: boolean;
  error?: string;
};

function fullstackSeed(operation: Operation) {
  return operation.kind === "fullstack.start" ||
    operation.kind === "preset.start"
    ? operation.phases.find((phase) => phase.id === "seed")
    : undefined;
}

type Props = {
  packages: Package[];
  seedPackages: string[];
  seedReady: boolean;
  operations: Operation[];
  busy?: string;
  prepareBusy?: string;
  onSeed: () => Promise<boolean>;
  onPrepare: () => Promise<boolean>;
};

export function useAccessToken({
  packages,
  seedPackages,
  seedReady,
  operations,
  busy,
  prepareBusy,
  onSeed,
  onPrepare,
}: Props) {
  const passedSeedIds = operations
    .filter((operation) =>
      operation.kind === "seed"
        ? operation.state === "passed"
        : fullstackSeed(operation)?.state === "passed"
    )
    .map((operation) => operation.id);
  const observedSeed = passedSeedIds.at(-1);
  const [seedRevision, setSeedRevision] = useState(() => ({
    id: observedSeed ?? "",
    seen: new Set(passedSeedIds),
  }));
  const hasNewSeed = Boolean(
    observedSeed && !seedRevision.seen.has(observedSeed)
  );
  // The bounded operation history can evict completed seeds; never fall back to an older cache key.
  if (observedSeed && hasNewSeed)
    setSeedRevision({
      id: observedSeed,
      seen: new Set([...seedRevision.seen, ...passedSeedIds]),
    });
  const completedSeed =
    observedSeed && hasNewSeed ? observedSeed : seedRevision.id;
  const identitiesQuery = useQuery({
    ...DashboardQueries.identities(completedSeed),
    refetchOnMount: "always",
  });
  const identities = identitiesQuery.data;
  const [selection, setSelection] = useState<Selection>({
    revision: completedSeed,
  });
  const currentSelection =
    selection.revision === completedSeed ? selection : undefined;
  const tenantKey =
    currentSelection?.tenantKey ?? identities?.tenants[0]?.key ?? "";
  const tenant = identities?.tenants.find((item) => item.key === tenantKey);
  const userId = currentSelection?.userId ?? tenant?.users[0]?.id ?? "";
  const selectedUser = tenant?.users.find((item) => item.id === userId);
  const token = currentSelection?.token ?? "";
  const copied = currentSelection?.copied ?? false;
  const generation = DashboardMutations.useGenerateToken();
  const generationRequest = useRef(false);
  const [submitting, setSubmitting] = useState<TokenAction>();
  const actionRequest = useRef(false);
  const [trackedActions, setTrackedActions] = useState<
    Partial<Record<TokenAction, TrackedAction>>
  >({});
  const [actionFailures, setActionFailures] = useState<
    Partial<Record<TokenAction, boolean>>
  >({});
  const activeSeed = operations.find(
    (operation) =>
      (operation.state === "pending" || operation.state === "running") &&
      (operation.kind === "seed" ||
        fullstackSeed(operation)?.state === "running")
  );
  const activePrepare = operations.find(
    (operation) =>
      operation.kind === "seed.prepare" &&
      (operation.state === "pending" || operation.state === "running")
  );
  const activeSeedId = activeSeed?.id;
  const activePrepareId = activePrepare?.id;
  const seeding = Boolean(busy || submitting === "seed" || activeSeed);
  const preparing = Boolean(
    prepareBusy || submitting === "seed.prepare" || activePrepare
  );
  const packagesRunning =
    seedPackages.length > 0 &&
    seedPackages.every(
      (name) => packages.find((item) => item.name === name)?.state === "running"
    );
  const controlsBusy = seeding || preparing || generation.isPending;
  const loading = identitiesQuery.isFetching;
  const [reloadCooling, setReloadCooling] = useState(false);
  const [reloadFeedback, setReloadFeedback] = useState<{
    revision: string;
    result: "ready" | "empty" | "failed";
  }>();
  const reloadRequest = useRef(false);
  const reloadTimer = useRef<number>();
  const mounted = useRef(true);
  const terminalFailures = tokenActions.filter((kind) => {
    const tracked = trackedActions[kind];
    if (!tracked) return false;
    const actionBusy = kind === "seed" ? busy : prepareBusy;
    const id =
      actionBusy && actionBusy !== "request" ? actionBusy : tracked.operationId;
    const operation = id
      ? operations.find((item) => item.id === id)
      : operations.find(
          (item) => item.kind === kind && !tracked.knownIds.has(item.id)
        );
    return (
      operation &&
      (operation.kind === "seed" || operation.kind === "seed.prepare"
        ? operation.state === "failed"
        : fullstackSeed(operation)?.state === "failed")
    );
  });
  const seedFailed = terminalFailures.includes("seed");
  const prepareFailed = terminalFailures.includes("seed.prepare");

  // Retain a compact failure after bounded history eviction; a new attempt clears it.
  useEffect(() => {
    for (const kind of tokenActions) {
      const id = kind === "seed" ? activeSeedId : activePrepareId;
      const failed = kind === "seed" ? seedFailed : prepareFailed;
      if (id) {
        setTrackedActions((previous) =>
          previous[kind]?.operationId === id
            ? previous
            : {
                ...previous,
                [kind]: { knownIds: new Set(), operationId: id },
              }
        );
        setActionFailures((previous) =>
          previous[kind] ? { ...previous, [kind]: false } : previous
        );
      } else if (failed) {
        setActionFailures((previous) =>
          previous[kind] ? previous : { ...previous, [kind]: true }
        );
      }
    }
  }, [activeSeedId, activePrepareId, seedFailed, prepareFailed]);

  // Query owns request cancellation; this cleanup prevents cooldown updates after leaving the page.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(reloadTimer.current);
    };
  }, []);

  const failedActions = tokenActions.filter(
    (kind) => actionFailures[kind] || terminalFailures.includes(kind)
  );

  async function runTokenAction(kind: TokenAction) {
    if (
      actionRequest.current ||
      generationRequest.current ||
      controlsBusy ||
      (kind === "seed" && seedReady) ||
      (kind === "seed.prepare" && packagesRunning)
    )
      return;
    actionRequest.current = true;
    setTrackedActions((previous) => ({
      ...previous,
      [kind]: {
        knownIds: new Set(operations.map((operation) => operation.id)),
      },
    }));
    setActionFailures((previous) => ({ ...previous, [kind]: false }));
    setSubmitting(kind);
    try {
      const accepted = await (kind === "seed" ? onSeed() : onPrepare());
      if (!accepted)
        setActionFailures((previous) => ({ ...previous, [kind]: true }));
    } catch {
      setActionFailures((previous) => ({ ...previous, [kind]: true }));
    } finally {
      actionRequest.current = false;
      if (mounted.current) setSubmitting(undefined);
    }
  }

  async function reloadIdentities() {
    if (reloadRequest.current || loading || controlsBusy) return;
    reloadRequest.current = true;
    setReloadCooling(true);
    setReloadFeedback(undefined);
    setSelection({ revision: completedSeed });
    const result = await identitiesQuery.refetch();
    if (!mounted.current) return;
    if (result.isSuccess) {
      const ready = result.data.ready && result.data.tenants.length > 0;
      setReloadFeedback({
        revision: completedSeed,
        result: ready ? "ready" : "empty",
      });
      if (ready) toast.success("Identities refreshed");
      else toast.info("No identities found. Run Seed local data.");
    } else if (result.isError) {
      setReloadFeedback({ revision: completedSeed, result: "failed" });
      toast.error(errorMessage(result.error));
    }
    reloadTimer.current = window.setTimeout(() => {
      reloadRequest.current = false;
      setReloadCooling(false);
    }, 2000);
  }

  function selectTenant(value: string) {
    setSelection({ revision: completedSeed, tenantKey: value });
  }
  function selectUser(value: string) {
    setSelection({ revision: completedSeed, tenantKey, userId: value });
  }
  async function generate() {
    if (
      generationRequest.current ||
      actionRequest.current ||
      controlsBusy ||
      !tenantKey ||
      !userId
    )
      return;
    generationRequest.current = true;
    const submittedSelection = { revision: completedSeed, tenantKey, userId };
    setSelection(submittedSelection);
    try {
      const data = await generation.mutateAsync({ tenantKey, userId });
      if (mounted.current)
        setSelection({ ...submittedSelection, token: data.sessionToken });
    } catch (failure) {
      if (mounted.current)
        setSelection({ ...submittedSelection, error: errorMessage(failure) });
    } finally {
      generationRequest.current = false;
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      if (mounted.current)
        setSelection({
          revision: completedSeed,
          tenantKey,
          userId,
          token,
          copied: true,
        });
    } catch {
      if (mounted.current)
        setSelection({
          revision: completedSeed,
          tenantKey,
          userId,
          token,
          error:
            "Clipboard access is unavailable. Select and copy the token manually.",
        });
    }
  }

  const reloadResult =
    reloadFeedback?.revision === completedSeed
      ? reloadFeedback.result
      : undefined;
  return {
    identities,
    tenantKey,
    userId,
    tenant,
    selectedUser,
    token,
    copied,
    error:
      currentSelection?.error ||
      (identitiesQuery.isError && !reloadCooling && reloadResult !== "failed"
        ? errorMessage(identitiesQuery.error)
        : ""),
    loading,
    reloadCooling,
    reloadResult,
    generating: generation.isPending,
    seeding,
    preparing,
    prepareReady: packagesRunning && !preparing,
    seedReady: seedReady && !seeding,
    controlsBusy,
    failedActions,
    runTokenAction,
    reloadIdentities,
    selectTenant,
    selectUser,
    generate,
    copy,
  };
}
