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

export type CatalogProcessClient = ReturnType<
  typeof catalogApi.createProcessApiClient
>;

export type TenantProcessClient = {
  tenant: ReturnType<typeof tenantApi.createTenantApiClient>;
  m2m: ReturnType<typeof tenantApi.createM2mApiClient>;
};

export type AttributeProcessClient = ReturnType<
  typeof attributeRegistryApi.createAttributeApiClient
>;

export type NotifierEventsClient = ReturnType<
  typeof notifierApi.createEventsApiClient
>;

export type AuthorizationProcessClient = {
  client: ReturnType<typeof authorizationApi.createClientApiClient>;
};

export type DelegationProcessClient = ReturnType<
  typeof delegationApi.createDelegationApiClient
>;

export type PagoPAInteropBeClients = {
  catalogProcessClient: CatalogProcessClient;
  agreementProcessClient: agreementApi.AgreementProcessClient;
  tenantProcessClient: TenantProcessClient;
  purposeProcessClient: purposeApi.PurposeProcessClient;
  attributeProcessClient: AttributeProcessClient;
  notifierEventsClient: NotifierEventsClient;
  authorizationProcessClient: AuthorizationProcessClient;
  delegationProcessClient: DelegationProcessClient;
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
    delegationProcessClient: delegationApi.createDelegationApiClient(
      config.delegationProcessUrl
    ),
  };
}
