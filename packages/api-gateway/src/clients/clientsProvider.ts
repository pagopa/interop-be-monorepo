import {
  agreementApi,
  purposeApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

export type TenantProcessClient = {
  tenant: ReturnType<typeof tenantApi.createTenantApiClient>;
};

export type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;

export type PagoPAInteropBeClients = {
  agreementProcessClient: AgreementProcessClient;
  tenantProcessClient: TenantProcessClient;
  purposeProcessClient: PurposeProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
    tenantProcessClient: {
      tenant: tenantApi.createTenantApiClient(config.tenantProcessUrl),
    },
    purposeProcessClient: purposeApi.createPurposeApiClient(
      config.purposeProcessUrl
    ),
  };
}
