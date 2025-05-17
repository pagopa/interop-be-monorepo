import * as tenantApi from "./generated/tenantApi.js";
import { QueryParametersByAlias } from "./utils.js";

type TenantApi = typeof tenantApi.tenantApi.api;

export type GetTenantsQueryParams = QueryParametersByAlias<
  TenantApi,
  "getTenants"
>;

export * from "./generated/tenantApi.js";
