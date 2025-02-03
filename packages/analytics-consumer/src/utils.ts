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
  sendAgreementAnalyticsUpdateV1,
  sendAttributeAnalyticsUpdateV1,
  sendCatalogAnalyticsUpdateV1,
  sendTenantAnalyticsUpdatev1,
  sendPurposeAnalyticsUpdatev1,
  sendAuthorizationAnalyticsAuthUpdateV1,
} from "./consumerServiceV1.js";
import {
  sendAgreementAnalyticsUpdateV2,
  sendCatalogAnalyticsUpdateV2,
  sendTenantAnalyticsUpdatev2,
  sendPurposeAnalyticsUpdatev2,
  sendDelegationAnalyticsUpdateV2,
  sendAuthorizationAnalyticsAuthUpdateV2,
} from "./consumerServiceV2.js";

type DecoderTypes =
  | typeof AgreementEvent
  | typeof AttributeEvent
  | typeof EServiceEvent
  | typeof TenantEvent
  | typeof PurposeEvent
  | typeof DelegationEvent
  | typeof AuthorizationEvent;

/* eslint-disable @typescript-eslint/no-explicit-any */
// We use `any` here because the union type becomes extremely verbose.
// The decoder handles runtime validation.
type TopicType = {
  decoder: DecoderTypes;
  handlers: { [version: number]: (msg: any) => Promise<void> };
};

export const topicConfigMap: Record<string, TopicType> = {
  [config.agreementTopic]: {
    decoder: AgreementEvent,
    handlers: {
      1: sendAgreementAnalyticsUpdateV1,
      2: sendAgreementAnalyticsUpdateV2,
    },
  },
  [config.attributeTopic]: {
    decoder: AttributeEvent,
    handlers: {
      1: sendAttributeAnalyticsUpdateV1,
    },
  },
  [config.catalogTopic]: {
    decoder: EServiceEvent,
    handlers: {
      1: sendCatalogAnalyticsUpdateV1,
      2: sendCatalogAnalyticsUpdateV2,
    },
  },
  [config.tenantTopic]: {
    decoder: TenantEvent,
    handlers: {
      1: sendTenantAnalyticsUpdatev1,
      2: sendTenantAnalyticsUpdatev2,
    },
  },
  [config.purposeTopic]: {
    decoder: PurposeEvent,
    handlers: {
      1: sendPurposeAnalyticsUpdatev1,
      2: sendPurposeAnalyticsUpdatev2,
    },
  },
  [config.delegationTopic]: {
    decoder: DelegationEvent,
    handlers: {
      2: sendDelegationAnalyticsUpdateV2,
    },
  },
  [config.authorizationTopic]: {
    decoder: AuthorizationEvent,
    handlers: {
      1: sendAuthorizationAnalyticsAuthUpdateV1,
      2: sendAuthorizationAnalyticsAuthUpdateV2,
    },
  },
};
