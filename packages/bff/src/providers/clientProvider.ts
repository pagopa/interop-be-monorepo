import { createApiClient as createApiClientTenantProcess } from "../model/generated/tenant-process/api.js";
import { createApiClient as createApiClientAgreementProcess } from "../model/generated/agreement-process/api.js";
import { createApiClient as createApiClientCatalogProcess } from "../model/generated/catalog-process/api.js";
import { createApiClient as createApiClientAttributeProcess } from "../model/generated/attribute-process/api.js";
import { createApiClient as createApiClientPurposeProcess } from "../model/generated/purpose-process/api.js";
import { createApiClient as createApiClientAuthorizationProcess } from "../model/generated/authorization-process/api.js";
import { config } from "../utilities/config.js";

export type TenantProcessClient = ReturnType<
  typeof createApiClientTenantProcess
>;
export type AgreementProcessClient = ReturnType<
  typeof createApiClientAgreementProcess
>;
export type CatalogProcessClient = ReturnType<
  typeof createApiClientCatalogProcess
>;
export type AttributeProcessClient = ReturnType<
  typeof createApiClientAttributeProcess
>;
export type PurposeProcessClient = ReturnType<
  typeof createApiClientPurposeProcess
>;
export type AuthorizationProcessClient = ReturnType<
  typeof createApiClientAuthorizationProcess
>;

export type Headers = { "X-Correlation-Id": string; Authorization: string };

export type PagoPAInteropBeClients = {
  tenantProcessClient: TenantProcessClient;
  attributeProcessClient: AttributeProcessClient;
  catalogProcessClient: CatalogProcessClient;
  agreementProcessClient: AgreementProcessClient;
  purposeProcessClient: PurposeProcessClient;
  authorizationClient: AuthorizationProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    tenantProcessClient: createApiClientTenantProcess(config.tenantProcessUrl),
    agreementProcessClient: createApiClientAgreementProcess(
      config.agreementProcessUrl
    ),
    catalogProcessClient: createApiClientCatalogProcess(
      config.catalogProcessUrl
    ),
    attributeProcessClient: createApiClientAttributeProcess(
      config.attributeRegistryUrl
    ),
    purposeProcessClient: createApiClientPurposeProcess(config.purposeUrl),
    authorizationClient: createApiClientAuthorizationProcess(
      config.authorizationUrl
    ),
  };
}
