import {
  agreementApi,
  catalogApi,
  purposeApi,
  tenantApi,
  attributeRegistryApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type CatalogProcessClient = ReturnType<
  typeof catalogApi.createProcessApiClient
>;

export type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

export type TenantProcessClient = {
  tenant: ReturnType<typeof tenantApi.createTenantApiClient>;
};

export type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;

export type AttributeProcessClient = ReturnType<
  typeof attributeRegistryApi.createAttributeApiClient
>;

export type PagoPAInteropBeClients = {
  catalogProcessClient: CatalogProcessClient;
  agreementProcessClient: AgreementProcessClient;
  tenantProcessClient: TenantProcessClient;
  purposeProcessClient: PurposeProcessClient;
  attributeProcessClient: AttributeProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    catalogProcessClient: catalogApi.createProcessApiClient(
      config.catalogProcessUrl
    ),
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
    tenantProcessClient: {
      tenant: tenantApi.createTenantApiClient(config.tenantProcessUrl),
    },
    purposeProcessClient: purposeApi.createPurposeApiClient(
      config.purposeProcessUrl
    ),
    attributeProcessClient: attributeRegistryApi.createAttributeApiClient(
      config.attributeRegistryProcessUrl
    ),
  };
}
