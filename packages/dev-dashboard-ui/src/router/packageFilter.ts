export type PackageFilter =
  | { kind: "all" }
  | { kind: "seed" }
  | { kind: "preset"; id: string };

export function readPackageFilter(parameters: URLSearchParams): PackageFilter {
  if (parameters.get("group") === "seed") return { kind: "seed" };
  const id = parameters.get("preset");
  return id ? { kind: "preset", id } : { kind: "all" };
}
