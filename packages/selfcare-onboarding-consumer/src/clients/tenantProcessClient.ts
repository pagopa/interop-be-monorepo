import { tenantApi } from "pagopa-interop-api-clients";

export type TenantProcessClient = {
  selfcare: ReturnType<typeof tenantApi.createSelfcareApiClient>;
};

export const tenantProcessClientBuilder = (
  url: string
): TenantProcessClient => ({
  selfcare: tenantApi.createSelfcareApiClient(url),
});
