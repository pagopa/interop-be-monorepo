export type PackageFilter =
  | { kind: "all" }
  | { kind: "seed" }
  | { kind: "jobs" }
  | { kind: "preset"; id: string };

export function readPackageFilter(parameters: URLSearchParams): PackageFilter {
  if (parameters.get("group") === "seed") return { kind: "seed" };
  if (parameters.get("group") === "jobs") return { kind: "jobs" };
  const id = parameters.get("preset");
  return id ? { kind: "preset", id } : { kind: "all" };
}
