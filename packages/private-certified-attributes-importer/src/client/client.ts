import {
  tenantApi,
  attributeRegistryApi,
  createZodiosClientEnhancedWithMetadata,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

function buildTenantProcessClient() {
  return createZodiosClientEnhancedWithMetadata(
    tenantApi.createInternalApiClient,
    config.tenantProcessUrl
  );
}

function buildAttributeRegistryClient() {
  return createZodiosClientEnhancedWithMetadata(
    attributeRegistryApi.createAttributeApiClient,
    config.attributeProcessUrl
  );
}

export type InteropClients = {
  tenantProcessClient: ReturnType<typeof buildTenantProcessClient>;
  attributeRegistryClient: ReturnType<typeof buildAttributeRegistryClient>;
};

export function getInteropClients(): InteropClients {
  return {
    tenantProcessClient: buildTenantProcessClient(),
    attributeRegistryClient: buildAttributeRegistryClient(),
  };
}
