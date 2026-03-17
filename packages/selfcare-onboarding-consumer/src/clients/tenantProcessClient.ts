import { tenantApi } from "pagopa-interop-api-clients";

export const tenantProcessClientBuilder = (
  url: string
): Pick<tenantApi.TenantProcessClient, "internal"> => ({
  internal: tenantApi.createInternalApiClient(url),
});
