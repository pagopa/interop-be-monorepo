import * as tenantApi from "./generated/tenantApi.js";
import { QueryParametersByAlias } from "./utils.js";

type TenantApi = typeof tenantApi.tenantApi.api;

export type TenantProcessClient = {
  tenant: ReturnType<typeof tenantApi.createTenantApiClient>;
  tenantAttribute: ReturnType<typeof tenantApi.createTenantAttributeApiClient>;
  selfcare: ReturnType<typeof tenantApi.createSelfcareApiClient>;
  m2m: ReturnType<typeof tenantApi.createM2mApiClient>;
};

export type GetTenantsQueryParams = QueryParametersByAlias<
  TenantApi,
  "getTenants"
>;

export * from "./generated/tenantApi.js";
