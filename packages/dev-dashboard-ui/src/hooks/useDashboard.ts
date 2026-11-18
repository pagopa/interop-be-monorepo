import { useDashboardActions } from "./useDashboardActions";
import { useRuntimeStatus } from "./useRuntimeStatus";

export type { ActionFailure } from "./useDashboardActions";

export function useDashboard() {
  const runtime = useRuntimeStatus();
  const actions = useDashboardActions(runtime.status, runtime.refresh);
  return { ...runtime, ...actions };
}
