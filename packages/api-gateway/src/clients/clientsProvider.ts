import { agreementApi, tenantApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

export type TenantProcessClient = {
  tenant: ReturnType<typeof tenantApi.createTenantApiClient>;
};

export type PagoPAInteropBeClients = {
  agreementProcessClient: AgreementProcessClient;
  tenantProcessClient: TenantProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
    tenantProcessClient: {
      tenant: tenantApi.createTenantApiClient(config.tenantProcessUrl),
    },
  };
}
