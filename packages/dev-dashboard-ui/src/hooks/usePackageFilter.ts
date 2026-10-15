import { useSearchParams } from "react-router-dom";

import { readPackageFilter, type PackageFilter } from "../router/packageFilter";

export function usePackageFilter() {
  const [parameters, setParameters] = useSearchParams();
  function changeFilter(filter: PackageFilter) {
    const query = new URLSearchParams();
    if (filter.kind === "seed") query.set("group", "seed");
    if (filter.kind === "preset") query.set("preset", filter.id);
    setParameters(query);
  }
  return { filter: readPackageFilter(parameters), changeFilter };
}
