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
import { createZodiosClientEnhancedWithMetadata } from "./zodiosWithMetadataPatch.js";
import { ZodiosClientWithMetadata } from "./zodiosWithMetadataPatch.js";

export type TenantProcessClient = {
  tenant: ZodiosClientWithMetadata<
    ReturnType<typeof tenantApi.createTenantApiClient>
  >;
  tenantAttribute: ZodiosClientWithMetadata<
    ReturnType<typeof tenantApi.createTenantAttributeApiClient>
  >;
  selfcare: ZodiosClientWithMetadata<
    ReturnType<typeof tenantApi.createSelfcareApiClient>
  >;
};

export type AttributeProcessClient = ZodiosClientWithMetadata<
  ReturnType<typeof attributeRegistryApi.createAttributeApiClient>
>;

export type CatalogProcessClient = ZodiosClientWithMetadata<
  ReturnType<typeof catalogApi.createProcessApiClient>
>;

export type AgreementProcessClient = ZodiosClientWithMetadata<
  ReturnType<typeof agreementApi.createAgreementApiClient>
>;

export type PurposeProcessClient = ZodiosClientWithMetadata<
  ReturnType<typeof purposeApi.createPurposeApiClient>
>;

export type DelegationProcessClient = {
  producer: ZodiosClientWithMetadata<
    ReturnType<typeof delegationApi.createProducerApiClient>
  >;
  consumer: ZodiosClientWithMetadata<
    ReturnType<typeof delegationApi.createConsumerApiClient>
  >;
  delegation: ZodiosClientWithMetadata<
    ReturnType<typeof delegationApi.createDelegationApiClient>
  >;
};

export type AuthorizationProcessClient = {
  client: ZodiosClientWithMetadata<
    ReturnType<typeof authorizationApi.createClientApiClient>
  >;
  producerKeychain: ZodiosClientWithMetadata<
    ReturnType<typeof authorizationApi.createProducerKeychainApiClient>
  >;
  user: ZodiosClientWithMetadata<
    ReturnType<typeof authorizationApi.createUserApiClient>
  >;
  token: ZodiosClientWithMetadata<
    ReturnType<typeof authorizationApi.createTokenGenerationApiClient>
  >;
  key: ZodiosClientWithMetadata<
    ReturnType<typeof authorizationApi.createKeyApiClient>
  >;
};

export type EServiceTemplateProcessClient = ZodiosClientWithMetadata<
  ReturnType<typeof eserviceTemplateApi.createProcessApiClient>
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
      tenant: createZodiosClientEnhancedWithMetadata(
        tenantApi.createTenantApiClient,
        config.tenantProcessUrl
      ),
      tenantAttribute: createZodiosClientEnhancedWithMetadata(
        tenantApi.createTenantAttributeApiClient,
        config.tenantProcessUrl
      ),
      selfcare: createZodiosClientEnhancedWithMetadata(
        tenantApi.createSelfcareApiClient,
        config.tenantProcessUrl
      ),
    },
    agreementProcessClient: createZodiosClientEnhancedWithMetadata(
      agreementApi.createAgreementApiClient,
      config.agreementProcessUrl
    ),
    catalogProcessClient: createZodiosClientEnhancedWithMetadata(
      catalogApi.createProcessApiClient,
      config.catalogProcessUrl
    ),
    attributeProcessClient: createZodiosClientEnhancedWithMetadata(
      attributeRegistryApi.createAttributeApiClient,
      config.attributeRegistryUrl
    ),
    purposeProcessClient: createZodiosClientEnhancedWithMetadata(
      purposeApi.createPurposeApiClient,
      config.purposeUrl
    ),
    authorizationClient: {
      client: createZodiosClientEnhancedWithMetadata(
        authorizationApi.createClientApiClient,
        config.authorizationUrl
      ),
      producerKeychain: createZodiosClientEnhancedWithMetadata(
        authorizationApi.createProducerKeychainApiClient,
        config.authorizationUrl
      ),
      user: createZodiosClientEnhancedWithMetadata(
        authorizationApi.createUserApiClient,
        config.authorizationUrl
      ),
      token: createZodiosClientEnhancedWithMetadata(
        authorizationApi.createTokenGenerationApiClient,
        config.authorizationUrl
      ),
      key: createZodiosClientEnhancedWithMetadata(
        authorizationApi.createKeyApiClient,
        config.authorizationUrl
      ),
    },
    delegationProcessClient: {
      producer: createZodiosClientEnhancedWithMetadata(
        delegationApi.createProducerApiClient,
        config.delegationProcessUrl
      ),
      consumer: createZodiosClientEnhancedWithMetadata(
        delegationApi.createConsumerApiClient,
        config.delegationProcessUrl
      ),
      delegation: createZodiosClientEnhancedWithMetadata(
        delegationApi.createDelegationApiClient,
        config.delegationProcessUrl
      ),
    },
    eserviceTemplateProcessClient: createZodiosClientEnhancedWithMetadata(
      eserviceTemplateApi.createProcessApiClient,
      config.eserviceTemplateProcessUrl
    ),
  };
}
