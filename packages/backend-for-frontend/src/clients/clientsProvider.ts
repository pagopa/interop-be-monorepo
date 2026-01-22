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

export type PagoPAInteropBeClients = {
  tenantProcessClient: tenantApi.TenantProcessClient;
  attributeProcessClient: attributeRegistryApi.AttributeProcessClient;
  catalogProcessClient: catalogApi.CatalogProcessClient;
  agreementProcessClient: agreementApi.AgreementProcessClient;
  purposeProcessClient: purposeApi.PurposeProcessClient;
  purposeTemplateProcessClient: purposeTemplateApi.PurposeTemplateProcessClient;
  authorizationClient: authorizationApi.AuthorizationProcessClient;
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient;
  selfcareV2UserClient: SelfcareV2UsersClient;
  delegationProcessClient: delegationApi.DelegationProcessClient;
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
      m2m: tenantApi.createM2mApiClient(config.tenantProcessUrl),
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
      key: authorizationApi.createKeyApiClient(config.authorizationUrl),
      producerKeychain: authorizationApi.createProducerKeychainApiClient(
        config.authorizationUrl
      ),
      user: authorizationApi.createUserApiClient(config.authorizationUrl),
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
      notificationConfigApi.createProcessApiClient(
        config.notificationConfigProcessUrl
      ),
    inAppNotificationManagerClient:
      inAppNotificationApi.createNotificationApiClient(
        config.inAppNotificationManagerUrl
      ),
  };
}
