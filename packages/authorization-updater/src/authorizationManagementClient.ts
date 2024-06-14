import { ZodiosInstance } from "@zodios/core";
import { api, createApiClient } from "./model/generated/api.js";

export type AuthorizationManagementClient = ZodiosInstance<typeof api.api>;

export const authorizationManagementClientBuilder = (
  url: string
): AuthorizationManagementClient => createApiClient(url);
