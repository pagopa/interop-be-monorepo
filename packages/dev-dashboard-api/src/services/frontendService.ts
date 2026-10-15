import {
  FrontendStatus,
  FrontendLogs,
  type FrontendLogSource,
} from "pagopa-interop-dev-dashboard-contracts";

export type FrontendService = {
  status: () => Promise<FrontendStatus>;
  logs: (source: FrontendLogSource) => Promise<FrontendLogs>;
};

export function frontendServiceBuilder(baseUrl: string): FrontendService {
  async function read(path: string): Promise<unknown> {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "error",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error("Frontend observer request failed");
    return response.json();
  }

  return {
    status: async () => {
      try {
        return FrontendStatus.parse(await read("/status"));
      } catch {
        return {
          available: false,
          running: false,
          state: "pending",
          phases: [],
          error: "Cannot reach the frontend runtime",
        };
      }
    },
    logs: async (source) =>
      FrontendLogs.parse(await read(`/logs?source=${source}`)),
  };
}
