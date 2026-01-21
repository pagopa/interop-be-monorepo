import {
  tenantApi,
  attributeRegistryApi,
  catalogApi,
  agreementApi,
  purposeApi,
  authorizationApi,
  selfcareV2ClientApi,
  selfcareV2InstitutionClientBuilder,
  selfcareV2UsersClientBuilder,
  delegationApi,
  eserviceTemplateApi,
  notificationConfigApi,
  inAppNotificationApi,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type TenantProcessClient = {
  tenant: ReturnType<typeof tenantApi.createTenantApiClient>;
  tenantAttribute: ReturnType<typeof tenantApi.createTenantAttributeApiClient>;
  selfcare: ReturnType<typeof tenantApi.createSelfcareApiClient>;
};

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

export type SelfcareV2InstitutionClient = {
  institution: ReturnType<
    typeof selfcareV2ClientApi.createInstitutionApiClient
  >;
};

export type SelfcareV2UserClient = {
  user: ReturnType<typeof selfcareV2ClientApi.createUserApiClient>;
};

export type NotificationConfigProcessClient = ReturnType<
  typeof notificationConfigApi.createProcessApiClient
>;

export type InAppNotificationManagerClient = ReturnType<
  typeof inAppNotificationApi.createNotificationApiClient
>;

export type PagoPAInteropBeClients = {
  tenantProcessClient: TenantProcessClient;
  attributeProcessClient: attributeRegistryApi.AttributeProcessClient;
  catalogProcessClient: catalogApi.CatalogProcessClient;
  agreementProcessClient: agreementApi.AgreementProcessClient;
  purposeProcessClient: purposeApi.PurposeProcessClient;
  purposeTemplateProcessClient: purposeTemplateApi.PurposeTemplateProcessClient;
  authorizationClient: AuthorizationProcessClient;
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient;
  selfcareV2UserClient: SelfcareV2UserClient;
  delegationProcessClient: DelegationProcessClient;
  eserviceTemplateProcessClient: EServiceTemplateProcessClient;
  notificationConfigProcessClient: NotificationConfigProcessClient;
  inAppNotificationManagerClient: InAppNotificationManagerClient;
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
    purposeTemplateProcessClient:
      purposeTemplateApi.createPurposeTemplateApiClient(
        config.purposeTemplateUrl
      ),
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
    selfcareV2InstitutionClient: {
      institution: selfcareV2InstitutionClientBuilder(config),
    },
    selfcareV2UserClient: {
      user: selfcareV2UsersClientBuilder(config),
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
    notificationConfigProcessClient:
      notificationConfigApi.createProcessApiClient(
        config.notificationConfigProcessUrl
      ),
    inAppNotificationManagerClient:
      inAppNotificationApi.createNotificationApiClient(
        config.inAppNotificationManagerUrl
      ),
  };
}
