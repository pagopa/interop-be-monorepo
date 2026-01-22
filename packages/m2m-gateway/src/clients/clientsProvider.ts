import {
  tenantApi,
  attributeRegistryApi,
  catalogApi,
  agreementApi,
  purposeApi,
  authorizationApi,
  delegationApi,
  eserviceTemplateApi,
  m2mEventApi,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import { createZodiosClientEnhancedWithMetadata } from "./zodiosWithMetadataPatch.js";
import { ZodiosClientWithMetadata } from "./zodiosWithMetadataPatch.js";

type TenantProcessClientWithMetadata = {
  [K in keyof tenantApi.TenantProcessClient]: ZodiosClientWithMetadata<
    tenantApi.TenantProcessClient[K]
  >;
};

export type CatalogProcessClientWithMetadata =
  ZodiosClientWithMetadata<catalogApi.CatalogProcessClient>;

type AttributeProcessClientWithMetadata = ZodiosClientWithMetadata<
  ReturnType<typeof attributeRegistryApi.createAttributeApiClient>
>;

type AgreementProcessClient =
  ZodiosClientWithMetadata<agreementApi.AgreementProcessClient>;

type PurposeProcessClient =
  ZodiosClientWithMetadata<purposeApi.PurposeProcessClient>;

export type DelegationProcessClientWithMetadata = {
  [K in keyof delegationApi.DelegationProcessClient]: ZodiosClientWithMetadata<
    delegationApi.DelegationProcessClient[K]
  >;
};

type AuthorizationProcessClientWithMetadata = {
  [K in keyof authorizationApi.AuthorizationProcessClient]: ZodiosClientWithMetadata<
    authorizationApi.AuthorizationProcessClient[K]
  >;
};

export type EServiceTemplateProcessClientWithMetadata =
  ZodiosClientWithMetadata<eserviceTemplateApi.EServiceTemplateProcessClient>;

type PurposeTemplateProcessClientWithMetadata =
  ZodiosClientWithMetadata<purposeTemplateApi.PurposeTemplateProcessClient>;

export type PagoPAInteropBeClients = {
  tenantProcessClient: TenantProcessClientWithMetadata;
  attributeProcessClient: AttributeProcessClientWithMetadata;
  catalogProcessClient: CatalogProcessClientWithMetadata;
  agreementProcessClient: AgreementProcessClient;
  purposeProcessClient: PurposeProcessClient;
  authorizationClient: AuthorizationProcessClientWithMetadata;
  delegationProcessClient: DelegationProcessClientWithMetadata;
  eserviceTemplateProcessClient: EServiceTemplateProcessClientWithMetadata;
  eventManagerClient: m2mEventApi.EventManagerClient;
  purposeTemplateProcessClient: PurposeTemplateProcessClientWithMetadata;
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
      m2m: createZodiosClientEnhancedWithMetadata(
        tenantApi.createM2mApiClient,
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
    eventManagerClient: m2mEventApi.createM2mEventsApiClient(
      config.eventManagerUrl
    ),
    purposeTemplateProcessClient: createZodiosClientEnhancedWithMetadata(
      purposeTemplateApi.createPurposeTemplateApiClient,
      config.purposeTemplateProcessUrl
    ),
  };
}
