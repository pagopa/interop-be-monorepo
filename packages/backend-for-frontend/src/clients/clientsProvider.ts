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
  notificationConfigProcessClient: notificationConfigApi.NotificationConfigProcessClient;
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
      config.attributeRegistryProcessUrl
    ),
    purposeProcessClient: purposeApi.createPurposeApiClient(config.purposeProcessUrl),
    purposeTemplateProcessClient:
      purposeTemplateApi.createPurposeTemplateApiClient(
        config.purposeTemplateProcessUrl
      ),
    authorizationClient: {
      client: authorizationApi.createClientApiClient(config.authorizationProcessUrl),
      producerKeychain: authorizationApi.createProducerKeychainApiClient(
        config.authorizationProcessUrl
      ),
      token: authorizationApi.createTokenGenerationApiClient(
        config.authorizationProcessUrl
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
      notificationConfigApi.createProcessApiClient(
        config.notificationConfigProcessUrl
      ),
    inAppNotificationManagerClient:
      inAppNotificationApi.createNotificationApiClient(
        config.inAppNotificationManagerUrl
      ),
  };
}
