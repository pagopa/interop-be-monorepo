import { ZodiosResponseByPath } from "@zodios/core";
import { api as tenant } from "../generated/tenant-process/api.js";

export type TenantProcessClientApi = typeof tenant.api;
export type TenantProcessApiResponse = ZodiosResponseByPath<
  TenantProcessClientApi,
  "get",
  "/tenants/:id"
>;
