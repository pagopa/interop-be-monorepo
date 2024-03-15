import { ZodiosInstance } from "@zodios/core";
import { authServiceConfig } from "pagopa-interop-commons";
import { api, createApiClient } from "./model/generated/api.js";

type Api = typeof api.api;

export const buildAuthMgmtClient = (): ZodiosInstance<Api> =>
  createApiClient(authServiceConfig().url);
