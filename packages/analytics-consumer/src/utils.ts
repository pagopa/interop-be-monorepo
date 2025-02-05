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
import { sendAgreementAnalyticsUpdateV1 } from "./agreement/consumerServiceV1.js";
import { sendAgreementAnalyticsUpdateV2 } from "./agreement/consumerServiceV2.js";
import { sendAttributeAnalyticsUpdateV1 } from "./attribute/consumerServiceV1.js";
import { sendAuthorizationAnalyticsAuthUpdateV1 } from "./authorization/consumerServiceV1.js";
import { sendAuthorizationAnalyticsAuthUpdateV2 } from "./authorization/consumerServiceV2.js";
import { sendCatalogAnalyticsUpdateV1 } from "./catalog/consumerServiceV1.js";
import { sendCatalogAnalyticsUpdateV2 } from "./catalog/consumerServiceV2.js";
import { sendDelegationAnalyticsUpdateV2 } from "./delegation/consumerServiceV2.js";
import { sendPurposeAnalyticsUpdatev1 } from "./purpose/consumerServiceV1.js";
import { sendPurposeAnalyticsUpdatev2 } from "./purpose/consumerServiceV2.js";
import { sendTenantAnalyticsUpdatev1 } from "./tenant/consumerServiceV1.js";
import { sendTenantAnalyticsUpdatev2 } from "./tenant/consumerServiceV2.js";

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
