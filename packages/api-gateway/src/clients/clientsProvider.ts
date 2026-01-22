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
  tenantProcessClient: tenantApi.TenantProcessClient;
  purposeProcessClient: purposeApi.PurposeProcessClient;
  attributeProcessClient: attributeRegistryApi.AttributeProcessClient;
  notifierEventsClient: notifierApi.NotifierEventsClient;
  authorizationProcessClient: authorizationApi.AuthorizationProcessClient;
  delegationProcessClient: delegationApi.DelegationProcessClient;
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
      tenantAttribute: tenantApi.createTenantAttributeApiClient(
        config.tenantProcessUrl
      ),
      selfcare: tenantApi.createSelfcareApiClient(config.tenantProcessUrl),
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
      key: authorizationApi.createKeyApiClient(config.authorizationProcessUrl),
      producerKeychain: authorizationApi.createProducerKeychainApiClient(
        config.authorizationProcessUrl
      ),
      user: authorizationApi.createUserApiClient(
        config.authorizationProcessUrl
      ),
      token: authorizationApi.createTokenGenerationApiClient(
        config.authorizationProcessUrl
      ),
    },
    delegationProcessClient: {
      producer: delegationApi.createProducerApiClient(
        config.delegationProcessUrl
      ),
      consumer: delegationApi.createConsumerApiClient(
        config.delegationProcessUrl
      ),
      delegation: delegationApi.createDelegationApiClient(
        config.delegationProcessUrl
      ),
    },
  };
}
