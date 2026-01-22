import { tenantApi } from "pagopa-interop-api-clients";

export const tenantProcessClientBuilder = (
  url: string
): tenantApi.TenantProcessClient => ({
  tenant: tenantApi.createTenantApiClient(url),
  tenantAttribute: tenantApi.createTenantAttributeApiClient(url),
  selfcare: tenantApi.createSelfcareApiClient(url),
  m2m: tenantApi.createM2mApiClient(url),
});
