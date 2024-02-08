import { ZodiosInstance } from "@zodios/core";
import { createApiClient } from "./model/generated/api.js";
import { api } from "./model/generated/api.js";

type Api = typeof api.api;

export function getAuthMgmtClient(options: {
  url: string;
  apiKey: string;
}): ZodiosInstance<Api> {
  const { url } = options;
  return createApiClient(url);
}
