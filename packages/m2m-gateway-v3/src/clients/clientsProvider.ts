/* eslint-disable @typescript-eslint/no-explicit-any */
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
import * as jose from "jose";
import {
  ZodiosEndpointDefinitions,
  ZodiosInstance,
  ZodiosOptions,
} from "@zodios/core";
import { config } from "../config/config.js";
import { createZodiosClientEnhancedWithMetadata } from "./zodiosWithMetadataPatch.js";
import { ZodiosClientWithMetadata } from "./zodiosWithMetadataPatch.js";
import { zodiosDPoPPlugin } from "./dpopPlugin.js";

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
export type EventManagerClient = ReturnType<
  typeof m2mEventApi.createM2mEventsApiClient
>;

export type PurposeTemplateProcessClient = ZodiosClientWithMetadata<
  ReturnType<typeof purposeTemplateApi.createPurposeTemplateApiClient>
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
  eventManagerClient: EventManagerClient;
  purposeTemplateProcessClient: PurposeTemplateProcessClient;
};

export async function getInteropBeClients(): Promise<PagoPAInteropBeClients> {
  const privateKey = await jose.importJWK(
    JSON.parse(config.dpopPrivateKeyJwk),
    "ES256"
  );
  const publicJwk = JSON.parse(config.dpopPublicKeyJwk);

  const createDPoPClient = <Api extends ZodiosEndpointDefinitions>(
    createClientFn: (
      baseUrl: string,
      options?: ZodiosOptions
    ) => ZodiosInstance<Api>,
    url: string
  ): ZodiosClientWithMetadata<ZodiosInstance<Api>> => {
    const client = createZodiosClientEnhancedWithMetadata(createClientFn, url);

    (client as any).use(zodiosDPoPPlugin(privateKey, publicJwk));

    return client;
  };

  return {
    tenantProcessClient: {
      tenant: createDPoPClient(
        tenantApi.createTenantApiClient,
        config.tenantProcessUrl
      ),
      tenantAttribute: createDPoPClient(
        tenantApi.createTenantAttributeApiClient,
        config.tenantProcessUrl
      ),
      selfcare: createDPoPClient(
        tenantApi.createSelfcareApiClient,
        config.tenantProcessUrl
      ),
    },
    agreementProcessClient: createDPoPClient(
      agreementApi.createAgreementApiClient,
      config.agreementProcessUrl
    ),
    catalogProcessClient: createDPoPClient(
      catalogApi.createProcessApiClient,
      config.catalogProcessUrl
    ),
    attributeProcessClient: createDPoPClient(
      attributeRegistryApi.createAttributeApiClient,
      config.attributeRegistryUrl
    ),
    purposeProcessClient: createDPoPClient(
      purposeApi.createPurposeApiClient,
      config.purposeUrl
    ),
    authorizationClient: {
      client: createDPoPClient(
        authorizationApi.createClientApiClient,
        config.authorizationUrl
      ),
      producerKeychain: createDPoPClient(
        authorizationApi.createProducerKeychainApiClient,
        config.authorizationUrl
      ),
      user: createDPoPClient(
        authorizationApi.createUserApiClient,
        config.authorizationUrl
      ),
      token: createDPoPClient(
        authorizationApi.createTokenGenerationApiClient,
        config.authorizationUrl
      ),
      key: createDPoPClient(
        authorizationApi.createKeyApiClient,
        config.authorizationUrl
      ),
    },
    delegationProcessClient: {
      producer: createDPoPClient(
        delegationApi.createProducerApiClient,
        config.delegationProcessUrl
      ),
      consumer: createDPoPClient(
        delegationApi.createConsumerApiClient,
        config.delegationProcessUrl
      ),
      delegation: createDPoPClient(
        delegationApi.createDelegationApiClient,
        config.delegationProcessUrl
      ),
    },
    eserviceTemplateProcessClient: createDPoPClient(
      eserviceTemplateApi.createProcessApiClient,
      config.eserviceTemplateProcessUrl
    ),
    eventManagerClient: m2mEventApi.createM2mEventsApiClient(
      config.eventManagerUrl
    ),
    purposeTemplateProcessClient: createDPoPClient(
      purposeTemplateApi.createPurposeTemplateApiClient,
      config.purposeTemplateProcessUrl
    ),
  };
}
