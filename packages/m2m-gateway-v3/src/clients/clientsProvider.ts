import {
  tenantApi,
  attributeRegistryApi,
  catalogApi,
  agreementApi,
  purposeApi,
  authorizationApi,
  delegationApi,
  eserviceTemplateApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type TenantProcessClient = {
  tenant: ReturnType<typeof tenantApi.createTenantApiClient>;
  tenantAttribute: ReturnType<typeof tenantApi.createTenantAttributeApiClient>;
  selfcare: ReturnType<typeof tenantApi.createSelfcareApiClient>;
};

export type AttributeProcessClient = ReturnType<
  typeof attributeRegistryApi.createAttributeApiClient
>;

export type CatalogProcessClient = ReturnType<
  typeof catalogApi.createProcessApiClient
>;

export type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

export type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;

export type DelegationProcessClient = {
  producer: ReturnType<typeof delegationApi.createProducerApiClient>;
  consumer: ReturnType<typeof delegationApi.createConsumerApiClient>;
  delegation: ReturnType<typeof delegationApi.createDelegationApiClient>;
};

export type AuthorizationProcessClient = {
  client: ReturnType<typeof authorizationApi.createClientApiClient>;
  producerKeychain: ReturnType<
    typeof authorizationApi.createProducerKeychainApiClient
  >;
  user: ReturnType<typeof authorizationApi.createUserApiClient>;
  token: ReturnType<typeof authorizationApi.createTokenGenerationApiClient>;
};

export type EServiceTemplateProcessClient = ReturnType<
  typeof eserviceTemplateApi.createProcessApiClient
>;

export type PagoPAInteropBeClients = {
  tenantProcessClient: TenantProcessClient;
  attributeProcessClient: AttributeProcessClient;
  catalogProcessClient: CatalogProcessClient;
  agreementProcessClient: AgreementProcessClient;
  purposeProcessClient: PurposeProcessClient;
  authorizationClient: AuthorizationProcessClient;
  delegationProcessClient: DelegationProcessClient;
  eserviceTemplateProcessClient: EServiceTemplateProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    tenantProcessClient: {
      tenant: tenantApi.createTenantApiClient(config.tenantProcessUrl),
      tenantAttribute: tenantApi.createTenantAttributeApiClient(
        config.tenantProcessUrl
      ),
      selfcare: tenantApi.createSelfcareApiClient(config.tenantProcessUrl),
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
    authorizationClient: {
      client: authorizationApi.createClientApiClient(config.authorizationUrl),
      producerKeychain: authorizationApi.createProducerKeychainApiClient(
        config.authorizationUrl
      ),
      user: authorizationApi.createUserApiClient(config.authorizationUrl),
      token: authorizationApi.createTokenGenerationApiClient(
        config.authorizationUrl
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
    eserviceTemplateProcessClient: eserviceTemplateApi.createProcessApiClient(
      config.eserviceTemplateProcessUrl
    ),
  };
}