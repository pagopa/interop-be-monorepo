import type {
  DashboardStatus,
  FrontendStatus,
} from "pagopa-interop-dev-dashboard-contracts";

export function fullstackStatus(
  status: DashboardStatus,
  frontend: FrontendStatus,
  connectionError: string
) {
  const preset = status.presets.find((item) => item.id === "frontend-full");
  const members =
    preset?.packages.map((member) => ({
      name: member.name,
      package: status.packages.find((item) => item.name === member.name),
    })) ?? [];
  const local = frontend.mode !== "dev";
  const startupPhases = frontend.phases.filter(
    (phase) =>
      local || !["infra", "backend", "seed", "identity"].includes(phase.id)
  );
  const operations = startupPhases.flatMap((phase) => {
    const operation = status.operations.find(
      (item) => item.id === phase.operationId
    );
    return operation ? [operation] : [];
  });
  const phases = [
    ...startupPhases,
    ...operations.flatMap((operation) => operation.phases),
  ];
  const failed =
    Boolean(connectionError || frontend.error) ||
    !frontend.available ||
    frontend.state === "failed" ||
    frontend.state === "stopped" ||
    phases.some((phase) => phase.state === "failed") ||
    operations.some((operation) => operation.state === "failed") ||
    (local &&
      (members.some((member) => member.package?.state === "failed") ||
        status.infrastructure.some((item) => item.state === "failed")));
  const starting =
    frontend.state === "pending" ||
    frontend.state === "running" ||
    phases.some(
      (phase) => phase.state === "pending" || phase.state === "running"
    ) ||
    operations.some(
      (operation) =>
        operation.state === "pending" || operation.state === "running"
    );
  const backendReady =
    members.length > 0 &&
    members.every((member) => member.package?.state === "running");
  const infrastructureReady =
    status.infrastructure.length > 0 &&
    status.infrastructure.every((item) => item.state === "running");
  const ready =
    frontend.running &&
    frontend.state === "passed" &&
    (!local || (backendReady && infrastructureReady && status.seedReady));
  return {
    members,
    startupPhases,
    local,
    readiness: failed
      ? "Needs attention"
      : starting
        ? "Starting"
        : ready
          ? local
            ? "Ready"
            : "Frontend ready"
          : "Needs attention",
  };
}
