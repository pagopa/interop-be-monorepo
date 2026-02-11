import {
  tenantApi,
  attributeRegistryApi,
  catalogApi,
  agreementApi,
  purposeApi,
  authorizationApi,
  selfcareV2InstitutionClientBuilder,
  selfcareV2UsersClientBuilder,
  SelfcareV2InstitutionClient,
  SelfcareV2UsersClient,
  delegationApi,
  eserviceTemplateApi,
  notificationConfigApi,
  inAppNotificationApi,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type TenantProcessClient = Pick<
  tenantApi.TenantProcessClient,
  "tenant" | "tenantAttribute" | "selfcare"
>;

export type AuthorizationProcessClient = Pick<
  authorizationApi.AuthorizationProcessClient,
  "client" | "producerKeychain" | "token"
>;

export type DelegationProcessClient = Pick<
  delegationApi.DelegationProcessClient,
  "producer" | "consumer" | "delegation"
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
  selfcareV2UserClient: SelfcareV2UsersClient;
  delegationProcessClient: DelegationProcessClient;
  eserviceTemplateProcessClient: eserviceTemplateApi.EServiceTemplateProcessClient;
  notificationConfigProcessClient: notificationConfigApi.NotificationConfigHeyApiClient;
  inAppNotificationManagerClient: inAppNotificationApi.InAppNotificationManagerClient;
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
      token: authorizationApi.createTokenGenerationApiClient(
        config.authorizationUrl
      ),
    },
    selfcareV2InstitutionClient: selfcareV2InstitutionClientBuilder(config),
    selfcareV2UserClient: selfcareV2UsersClientBuilder(config),
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
      notificationConfigApi.createNotificationConfigClient(
        config.notificationConfigProcessUrl
      ),
    inAppNotificationManagerClient:
      inAppNotificationApi.createNotificationApiClient(
        config.inAppNotificationManagerUrl
      ),
  };
}
