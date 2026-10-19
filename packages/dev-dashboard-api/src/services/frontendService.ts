import { randomUUID } from "node:crypto";
import { request } from "node:http";
import {
  FrontendAction,
  FrontendStatus,
  FrontendLogs,
  type DashboardAction,
  type OperationAccepted,
  type Phase,
  type FrontendLogSource,
} from "pagopa-interop-dev-dashboard-contracts";

import type { IdentityService } from "./identityService.js";
import type { Supervisor } from "./supervisorService.js";

import {
  DASHBOARD_TIMING,
  FRONTEND_AGENT_LIMITS,
  FRONTEND_STARTUP_PHASES,
  LOG_SOURCES,
} from "../config/constants.js";
import {
  FrontendAgentError,
  FrontendAgentStatus,
  type FrontendAgentCommand,
  type FrontendIdentitySelection,
  type FrontendLocalStartCommand,
  type FrontendProgress,
} from "../model/domain/frontend.js";
import { errorMessage } from "../utilities/errorUtils.js";

export type FrontendService = {
  status(): Promise<FrontendStatus>;
  logs(source: FrontendLogSource): Promise<FrontendLogs>;
  action(input: unknown): OperationAccepted;
  idle(): Promise<void>;
  shutdown(): Promise<void>;
};

async function read(
  baseUrl: string,
  signal: AbortSignal,
  path: string
): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "error",
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(DASHBOARD_TIMING.frontendRequestTimeoutMs),
    ]),
  });
  if (!response.ok) {
    const body = FrontendAgentError.safeParse(await response.json());
    throw new Error(
      body.success ? body.data.error : "Frontend agent request failed"
    );
  }
  return response.json();
}

async function runtimeStatus(
  baseUrl: string,
  signal: AbortSignal
): Promise<FrontendAgentStatus> {
  try {
    return FrontendAgentStatus.parse(await read(baseUrl, signal, "/status"));
  } catch {
    return {
      available: false,
      running: false,
      state: "pending",
      phases: [],
      error: "Cannot reach the frontend runtime",
    };
  }
}

async function command(
  baseUrl: string,
  signal: AbortSignal,
  input: FrontendAgentCommand
): Promise<void> {
  // Installation can take longer than native fetch's response-header timeout.
  await new Promise<void>((resolve, reject) => {
    const call = request(
      new URL("/commands", baseUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(DASHBOARD_TIMING.frontendCommandTimeoutMs),
        ]),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > FRONTEND_AGENT_LIMITS.responseBytes)
            response.destroy(
              new Error("Frontend command response is too large")
            );
          else chunks.push(chunk);
        });
        response.once("error", reject);
        response.once("end", () => {
          if (response.statusCode === 200) {
            resolve();
            return;
          }
          try {
            const body = FrontendAgentError.parse(
              JSON.parse(Buffer.concat(chunks).toString("utf8"))
            );
            reject(new Error(body.error));
          } catch {
            reject(new Error("Frontend command failed"));
          }
        });
      }
    );
    call.once("error", reject);
    call.end(JSON.stringify(input));
  });
}

async function token(
  identities: IdentityService,
  identity: FrontendIdentitySelection
): Promise<FrontendLocalStartCommand> {
  const data = await identities.identities();
  const user = data.tenants
    .find((tenant) => tenant.key === identity.tenantKey)
    ?.users.find((candidate) => candidate.key === identity.userKey);
  if (!data.ready || !user)
    throw new Error("Unknown or unseeded local identity");
  const { sessionToken } = await identities.identity({
    tenantKey: identity.tenantKey,
    userId: user.id,
  });
  return { type: "start", mode: "local", sessionToken, identity };
}

export function frontendServiceBuilder(
  baseUrl: string,
  supervisor: Supervisor,
  identities: IdentityService
): FrontendService {
  const cancellation = new AbortController();
  let progress: FrontendProgress | undefined;
  let pending: Promise<void> = Promise.resolve();

  async function active(): Promise<FrontendAgentStatus> {
    if (cancellation.signal.aborted)
      throw new Error("Dashboard is shutting down");
    const runtime = await runtimeStatus(baseUrl, cancellation.signal);
    if (cancellation.signal.aborted)
      throw new Error("Dashboard is shutting down");
    if (!runtime.available)
      throw new Error("Cannot reach the frontend runtime");
    return runtime;
  }

  async function run(action: FrontendAction, phases: Phase[]): Promise<void> {
    const phase = async (
      id: string,
      work: (phase: Phase) => Promise<void>
    ): Promise<void> => {
      const item = phases.find((candidate) => candidate.id === id);
      if (!item) throw new Error(`Unknown fullstack phase: ${id}`);
      item.state = "running";
      supervisor.logs.append(LOG_SOURCES.orchestration, `INFO ${item.label}`);
      try {
        await active();
        await work(item);
        item.state = "passed";
      } catch (error) {
        item.state = "failed";
        item.error = errorMessage(error);
        throw error;
      }
    };
    const backend = (id: string, input: DashboardAction): Promise<void> =>
      phase(id, async (item) => {
        item.operationId = supervisor.action(input).operationId;
        await supervisor.idle();
        const operation = supervisor
          .status()
          .operations.find((candidate) => candidate.id === item.operationId);
        if (operation?.state !== "passed")
          throw new Error(operation?.error ?? "Backend operation failed");
      });
    const previous = await active();
    let local: FrontendLocalStartCommand | undefined;
    const identity = (): Promise<void> =>
      phase("identity", async () => {
        local = await token(
          identities,
          action.type === "identity"
            ? { tenantKey: action.tenantKey, userKey: action.userKey }
            : (previous.identity ?? { tenantKey: "comune", userKey: "admin" })
        );
      });
    const start = (): Promise<void> =>
      phase("vite", async () => {
        if (!local) throw new Error("Local identity has not been selected");
        await command(baseUrl, cancellation.signal, local);
      });
    switch (action.type) {
      case "start":
        if (!previous.running)
          await phase("install", async () =>
            command(baseUrl, cancellation.signal, { type: "install" })
          );
        else {
          const install = phases.find((item) => item.id === "install");
          if (install) install.state = "skipped";
        }
        await phase("dashboard", async () => undefined);
        await backend("infra", { type: "infra.start" });
        await backend("backend", { type: "preset.start", id: "frontend-full" });
        await backend("seed", { type: "seed" });
        await identity();
        await start();
        await phase("smoke", async () =>
          command(baseUrl, cancellation.signal, { type: "smoke" })
        );
        await phase("browser", async () =>
          command(baseUrl, cancellation.signal, { type: "browser" })
        );
        break;
      case "stop":
        await phase("vite", async () =>
          command(baseUrl, cancellation.signal, { type: "stop" })
        );
        await backend("backend", { type: "preset.stop", id: "frontend-full" });
        break;
      case "reset":
        await phase("vite", async () =>
          command(baseUrl, cancellation.signal, { type: "stop" })
        );
        await backend("infra", { type: "infra.reset", confirm: true });
        break;
      case "use-dev":
        await phase("vite", async () =>
          command(baseUrl, cancellation.signal, { type: "start", mode: "dev" })
        );
        break;
      case "use-local":
      case "identity":
        await identity();
        await start();
        break;
    }
  }

  function action(input: unknown): OperationAccepted {
    const action = FrontendAction.parse(input);
    if (cancellation.signal.aborted)
      throw new Error("Dashboard is shutting down");
    if (progress?.state === "running")
      throw new Error("A frontend operation is already running");
    const operationId = randomUUID();
    const selected =
      action.type === "start"
        ? FRONTEND_STARTUP_PHASES.map(([id]) => id)
        : action.type === "stop"
          ? ["vite", "backend"]
          : action.type === "reset"
            ? ["vite", "infra"]
            : action.type === "use-dev"
              ? ["vite"]
              : ["identity", "vite"];
    const current: FrontendProgress = {
      state: "running",
      operationId,
      phases: FRONTEND_STARTUP_PHASES.map(([id, label]) => ({
        id,
        label,
        state: selected.includes(id) ? "pending" : "skipped",
      })),
    };
    progress = current;
    pending = run(action, current.phases)
      .then(async () => {
        const runtime = await active();
        current.state = runtime.running ? "passed" : "stopped";
      })
      .catch(async (error: unknown) => {
        current.error = errorMessage(error);
        current.phases
          .filter((item) => item.state === "pending")
          .forEach((item) => {
            item.state = "skipped";
          });
        supervisor.logs.append(
          LOG_SOURCES.orchestration,
          `ERROR Frontend ${action.type}: ${current.error}`
        );
        if (action.type === "start" && !cancellation.signal.aborted) {
          try {
            await command(baseUrl, cancellation.signal, { type: "stop" });
          } catch {
            /* The frontend may have stopped during startup. */
          }
        }
        current.state = "failed";
      });
    return { operationId };
  }

  async function status(): Promise<FrontendStatus> {
    const runtime = FrontendStatus.strip().parse(
      await runtimeStatus(baseUrl, cancellation.signal)
    );
    return structuredClone(
      progress
        ? {
            ...runtime,
            ...progress,
            state:
              progress.state === "passed" && !runtime.running
                ? "stopped"
                : progress.state,
          }
        : runtime
    );
  }

  async function logs(source: FrontendLogSource): Promise<FrontendLogs> {
    return FrontendLogs.parse(
      await read(baseUrl, cancellation.signal, `/logs?source=${source}`)
    );
  }

  function idle(): Promise<void> {
    return pending;
  }

  async function shutdown(): Promise<void> {
    cancellation.abort();
    await pending;
  }

  return { status, logs, action, idle, shutdown };
}
