import {
  tenantApi,
  attributeRegistryApi,
  catalogApi,
  agreementApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { config } from "../utilities/config.js";

type TenantProcessClient = {
  tenants: ReturnType<typeof tenantApi.createTenantApiClient>;
};

type AttributeProcessClient = ReturnType<
  typeof attributeRegistryApi.createAttributeApiClient
>;

type CatalogProcessClient = ReturnType<
  typeof catalogApi.createProcessApiClient
>;

type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;

export type PagoPAInteropBeClients = {
  tenantProcessClient: TenantProcessClient;
  attributeProcessClient: AttributeProcessClient;
  catalogProcessClient: CatalogProcessClient;
  agreementProcessClient: AgreementProcessClient;
  purposeProcessClient: PurposeProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    tenantProcessClient: {
      tenants: tenantApi.createTenantApiClient(config.tenantProcessUrl),
    },
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
    catalogProcessClient: catalogApi.createProcessApiClient(
      config.catalogProcessUrl
    ),
    attributeProcessClient: attributeRegistryApi.createAttributeApiClient(
      config.attributeRegistryUrl
    ),
    purposeProcessClient: purposeApi.createPurposeApiClient(config.purposeUrl),
  };
}
