import { ZodiosOptions } from "@zodios/core";
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
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import { createZodiosClientEnhancedWithMetadata } from "./zodiosWithMetadataPatch.js";
import { ZodiosClientWithMetadata } from "./zodiosWithMetadataPatch.js";

const createSelfcareClientConfig = (selfcareApiKey: string): ZodiosOptions => ({
  axiosConfig: {
    headers: {
      "Ocp-Apim-Subscription-Key": selfcareApiKey,
    },
  },
});

type TenantProcessClient = Pick<
  tenantApi.TenantProcessClient,
  "tenant" | "tenantAttribute"
>;

type TenantProcessClientWithMetadata = {
  [K in keyof TenantProcessClient]: ZodiosClientWithMetadata<
    TenantProcessClient[K]
  >;
};

type AttributeProcessClientWithMetadata = ZodiosClientWithMetadata<
  ReturnType<typeof attributeRegistryApi.createAttributeApiClient>
>;

export type CatalogProcessClientWithMetadata =
  ZodiosClientWithMetadata<catalogApi.CatalogProcessClient>;

type AgreementProcessClient =
  ZodiosClientWithMetadata<agreementApi.AgreementProcessClient>;

type PurposeProcessClient =
  ZodiosClientWithMetadata<purposeApi.PurposeProcessClient>;

export type DelegationProcessClientWithMetadata = {
  [K in keyof delegationApi.DelegationProcessClient]: ZodiosClientWithMetadata<
    delegationApi.DelegationProcessClient[K]
  >;
};

type AuthorizationProcessClient = Pick<
  authorizationApi.AuthorizationProcessClient,
  "client" | "producerKeychain" | "key"
>;

type AuthorizationProcessClientWithMetadata = {
  [K in keyof AuthorizationProcessClient]: ZodiosClientWithMetadata<
    AuthorizationProcessClient[K]
  >;
};

export type EServiceTemplateProcessClientWithMetadata =
  ZodiosClientWithMetadata<eserviceTemplateApi.EServiceTemplateProcessClient>;

type PurposeTemplateProcessClientWithMetadata =
  ZodiosClientWithMetadata<purposeTemplateApi.PurposeTemplateProcessClient>;

export type SelfcareV2Client = ZodiosClientWithMetadata<
  ReturnType<typeof selfcareV2ClientApi.createInstitutionApiClient>
>;

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
  selfcareV2Client: SelfcareV2Client;
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
    selfcareV2Client: createZodiosClientEnhancedWithMetadata(
      selfcareV2ClientApi.createInstitutionApiClient,
      config.selfcareBaseUrl,
      createSelfcareClientConfig(config.selfcareApiKey)
    ),
  };
}
