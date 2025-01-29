import {
  AgreementEvent,
  AttributeEvent,
  EServiceEvent,
  TenantEvent,
  PurposeEvent,
  DelegationEvent,
  AuthorizationEvent,
} from "pagopa-interop-models";
import { config } from "./config/config.js";
import {
  sendAgreementKpiUpdateV1,
  sendAttributeKpiUpdateV1,
  sendCatalogKpiUpdateV1,
  sendTenantKpiUpdatev1,
  sendPurposeKpiUpdatev1,
  sendAuthorizationKpiAuthUpdateV1,
} from "./consumerServiceV1.js";
import {
  sendAgreementKpiUpdateV2,
  sendCatalogKpiUpdateV2,
  sendTenantKpiUpdatev2,
  sendPurposeKpiUpdatev2,
  sendDelegationKpiUpdateV2,
  sendAuthorizationKpiAuthUpdateV2,
} from "./consumerServiceV2.js";

export const topicConfigMap = {
  [config.agreementTopic]: {
    decoder: AgreementEvent,
    handlers: {
      1: sendAgreementKpiUpdateV1,
      2: sendAgreementKpiUpdateV2,
    },
  },
  [config.attributeTopic]: {
    decoder: AttributeEvent,
    handlers: {
      1: sendAttributeKpiUpdateV1,
    },
  },
  [config.catalogTopic]: {
    decoder: EServiceEvent,
    handlers: {
      1: sendCatalogKpiUpdateV1,
      2: sendCatalogKpiUpdateV2,
    },
  },
  [config.tenantTopic]: {
    decoder: TenantEvent,
    handlers: {
      1: sendTenantKpiUpdatev1,
      2: sendTenantKpiUpdatev2,
    },
  },
  [config.purposeTopic]: {
    decoder: PurposeEvent,
    handlers: {
      1: sendPurposeKpiUpdatev1,
      2: sendPurposeKpiUpdatev2,
    },
  },
  [config.delegationTopic]: {
    decoder: DelegationEvent,
    handlers: {
      2: sendDelegationKpiUpdateV2,
    },
  },
  [config.authorizationTopic]: {
    decoder: AuthorizationEvent,
    handlers: {
      1: sendAuthorizationKpiAuthUpdateV1,
      2: sendAuthorizationKpiAuthUpdateV2,
    },
  },
};
