import { schemas } from "pagopa-interop-dev-dashboard-contracts";
import { useNavigate, useSearchParams } from "react-router-dom";

import { paths } from "../router/paths";

export function useLogNavigation() {
  const navigate = useNavigate();
  return (source: string, level = "") => {
    const query = new URLSearchParams();
    if (source) query.set("source", source);
    if (level) query.set("level", level);
    void navigate(`${paths.logs}${query.size ? `?${query}` : ""}`);
  };
}

export function useLogRoute() {
  const [parameters] = useSearchParams();
  const level = schemas.LogEntry.shape.level.safeParse(parameters.get("level"));
  return {
    source: parameters.get("source") ?? "",
    level: level.success ? level.data : "",
    changeFilters: useLogNavigation(),
  };
}
