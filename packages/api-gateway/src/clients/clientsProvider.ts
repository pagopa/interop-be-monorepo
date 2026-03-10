import {
  agreementApi,
  catalogApi,
  purposeApi,
  tenantApi,
  attributeRegistryApi,
  notifierApi,
  authorizationApi,
  delegationApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type PagoPAInteropBeClients = {
  catalogProcessClient: catalogApi.CatalogProcessClient;
  agreementProcessClient: agreementApi.AgreementProcessClient;
  tenantProcessClient: Pick<tenantApi.TenantProcessClient, "tenant" | "m2m">;
  purposeProcessClient: purposeApi.PurposeProcessClient;
  attributeProcessClient: attributeRegistryApi.AttributeProcessClient;
  notifierEventsClient: notifierApi.NotifierEventsClient;
  authorizationProcessClient: Pick<
    authorizationApi.AuthorizationProcessClient,
    "client"
  >;
  delegationProcessClient: Pick<
    delegationApi.DelegationProcessClient,
    "delegation"
  >;
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
      m2m: tenantApi.createM2mApiClient(config.tenantProcessUrl),
    },
    purposeProcessClient: purposeApi.createPurposeApiClient(
      config.purposeProcessUrl
    ),
    attributeProcessClient: attributeRegistryApi.createAttributeApiClient(
      config.attributeRegistryProcessUrl
    ),
    notifierEventsClient: notifierApi.createEventsApiClient(config.notifierUrl),
    authorizationProcessClient: {
      client: authorizationApi.createClientApiClient(
        config.authorizationProcessUrl
      ),
    },
    delegationProcessClient: {
      delegation: delegationApi.createDelegationApiClient(
        config.delegationProcessUrl
      ),
    },
  };
}
