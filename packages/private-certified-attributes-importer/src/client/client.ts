import { tenantApi, attributeRegistryApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type InteropClients = {
  tenantProcessClient: ReturnType<typeof tenantApi.createInternalApiClient>;
  attributeRegistryClient: ReturnType<
    typeof attributeRegistryApi.createAttributeApiClient
  >;
};

export function getInteropClients(): InteropClients {
  return {
    tenantProcessClient: tenantApi.createInternalApiClient(
      config.tenantProcessUrl
    ),
    attributeRegistryClient: attributeRegistryApi.createAttributeApiClient(
      config.attributeProcessUrl
    ),
  };
}
