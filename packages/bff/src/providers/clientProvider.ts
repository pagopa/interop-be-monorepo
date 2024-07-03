import { createApiClient as createApiClientTenantProcess } from "../model/generated/tenant-process/api.js";
import { createApiClient as createApiClientAgreementProcess } from "../model/generated/agreement-process/api.js";
import { createApiClient as createApiClientCatalogProcess } from "../model/generated/catalog-process/api.js";
import { createApiClient as createApiClientAttributeProcess } from "../model/generated/attribute-process/api.js";
import { createApiClient as createApiClientPurposeProcess } from "../model/generated/purpose-process/api.js";
import { config } from "../utilities/config.js";

export type PagoPAInteropBeClients = {
  tenantProcessClient: ReturnType<typeof createApiClientTenantProcess>;
  attributeProcessClient: ReturnType<typeof createApiClientAttributeProcess>;
  catalogProcessClient: ReturnType<typeof createApiClientCatalogProcess>;
  agreementProcessClient: ReturnType<typeof createApiClientAgreementProcess>;
  purposeProcessClient: ReturnType<typeof createApiClientPurposeProcess>;
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
  };
}
