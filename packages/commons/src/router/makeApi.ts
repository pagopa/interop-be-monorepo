import type { EndpointDefinition } from "./typedRouter.js";

export function makeApi<const T extends ReadonlyArray<EndpointDefinition>>(
  api: T
): T {
  return api;
}
