/* eslint-disable functional/immutable-data */

import { KafkaMessage } from "kafkajs";
import { decodeKafkaMessage } from "pagopa-interop-commons";
import {
  EServiceEventEnvelopeV1,
  EServiceEventEnvelopeV2,
  EServiceEvent,
  AgreementEventEnvelopeV1,
  AgreementEventEnvelopeV2,
  AgreementEvent,
  AttributeEvent,
  PurposeEventEnvelopeV1,
  PurposeEventEnvelopeV2,
  PurposeEvent,
  TenantEventEnvelopeV1,
  TenantEventEnvelopeV2,
  TenantEvent,
  AuthorizationEventEnvelopeV1,
  AuthorizationEventEnvelopeV2,
  AuthorizationEvent,
  DelegationEventEnvelopeV2,
  DelegationEvent,
  EServiceTemplateEventEnvelopeV2,
  EServiceTemplateEvent,
  genericInternalError,
  AttributeEventEnvelope,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DBContext } from "../db/db.js";
import { config } from "../config/config.js";
import { handleAgreementMessageV1 } from "./agreement/consumerServiceV1.js";
import { handleAgreementMessageV2 } from "./agreement/consumerServiceV2.js";
import { handleAttributeMessageV1 } from "./attribute/consumerServiceV1.js";
import { handleAuthorizationMessageV1 } from "./authorization/consumerServiceV1.js";
import { handleAuthorizationEventMessageV2 } from "./authorization/consumerServiceV2.js";
import { handleCatalogMessageV1 } from "./catalog/consumerServiceV1.js";
import { handleCatalogMessageV2 } from "./catalog/consumerServiceV2.js";
import { handleDelegationMessageV2 } from "./delegation/consumerServiceV2.js";
import { handleEserviceTemplateMessageV2 } from "./eservice-template/consumerServiceV2.js";
import { handlePurposeMessageV1 } from "./purpose/consumerServiceV1.js";
import { handlePurposeMessageV2 } from "./purpose/consumerServiceV2.js";
import { handleTenantMessageV1 } from "./tenant/consumerServiceV1.js";
import { handleTenantMessageV2 } from "./tenant/consumerServiceV2.js";

/**
 * Processes a list of Kafka messages for the specified topic by decoding each message and invoking the corresponding handler.
 *
 * @param {KafkaMessage[]} kafkaMessages - An array of Kafka messages belonging to the given topic.
 * @param {string} topic - The Kafka topic from which the messages originate.
 * @param {DBContext} dbContext - The database context required by the handlers.
 * @returns {Promise<void>} A promise that resolves when all messages have been processed.
 * @throws {Error} If the topic is unknown.
 */
export async function executeTopicHandler(
  kafkaMessages: KafkaMessage[],
  topic: string,
  dbContext: DBContext
): Promise<void> {
  await match(topic)
    .with(config.catalogTopic, async () => {
      const eserviceV1: EServiceEventEnvelopeV1[] = [];
      const eserviceV2: EServiceEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, EServiceEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 1 }, (msg) => eserviceV1.push(msg))
          .with({ event_version: 2 }, (msg) => eserviceV2.push(msg))
          .exhaustive();
      }
      if (eserviceV1.length > 0) {
        await handleCatalogMessageV1(eserviceV1, dbContext);
      }
      if (eserviceV2.length > 0) {
        await handleCatalogMessageV2(eserviceV2, dbContext);
      }
    })
    .with(config.agreementTopic, async () => {
      const agreementV1: AgreementEventEnvelopeV1[] = [];
      const agreementV2: AgreementEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, AgreementEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 1 }, (msg) => agreementV1.push(msg))
          .with({ event_version: 2 }, (msg) => agreementV2.push(msg))
          .exhaustive();
      }
      if (agreementV1.length > 0) {
        await handleAgreementMessageV1(agreementV1, dbContext);
      }
      if (agreementV2.length > 0) {
        await handleAgreementMessageV2(agreementV2, dbContext);
      }
    })
    .with(config.attributeTopic, async () => {
      const attributeV1: AttributeEventEnvelope[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, AttributeEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 1 }, (msg) => attributeV1.push(msg))
          .exhaustive();
      }
      if (attributeV1.length > 0) {
        await handleAttributeMessageV1(attributeV1, dbContext);
      }
    })
    .with(config.purposeTopic, async () => {
      const purposeV1: PurposeEventEnvelopeV1[] = [];
      const purposeV2: PurposeEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, PurposeEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 1 }, (msg) => purposeV1.push(msg))
          .with({ event_version: 2 }, (msg) => purposeV2.push(msg))
          .exhaustive();
      }
      if (purposeV1.length > 0) {
        await handlePurposeMessageV1(purposeV1, dbContext);
      }
      if (purposeV2.length > 0) {
        await handlePurposeMessageV2(purposeV2, dbContext);
      }
    })
    .with(config.tenantTopic, async () => {
      const tenantV1: TenantEventEnvelopeV1[] = [];
      const tenantV2: TenantEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, TenantEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 1 }, (msg) => tenantV1.push(msg))
          .with({ event_version: 2 }, (msg) => tenantV2.push(msg))
          .exhaustive();
      }
      if (tenantV1.length > 0) {
        await handleTenantMessageV1(tenantV1, dbContext);
      }
      if (tenantV2.length > 0) {
        await handleTenantMessageV2(tenantV2, dbContext);
      }
    })
    .with(config.authorizationTopic, async () => {
      const authV1: AuthorizationEventEnvelopeV1[] = [];
      const authV2: AuthorizationEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, AuthorizationEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 1 }, (msg) => authV1.push(msg))
          .with({ event_version: 2 }, (msg) => authV2.push(msg))
          .exhaustive();
      }
      if (authV1.length > 0) {
        await handleAuthorizationMessageV1(authV1, dbContext);
      }
      if (authV2.length > 0) {
        await handleAuthorizationEventMessageV2(authV2, dbContext);
      }
    })
    .with(config.delegationTopic, async () => {
      const delegationV2: DelegationEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, DelegationEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 2 }, (msg) => delegationV2.push(msg))
          .exhaustive();
      }
      if (delegationV2.length > 0) {
        await handleDelegationMessageV2(delegationV2, dbContext);
      }
    })
    .with(config.eserviceTemplateTopic, async () => {
      const templateV2: EServiceTemplateEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, EServiceTemplateEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 2 }, (msg) => templateV2.push(msg))
          .exhaustive();
      }
      if (templateV2.length > 0) {
        await handleEserviceTemplateMessageV2(templateV2, dbContext);
      }
    })
    .otherwise(() => {
      throw genericInternalError(`Unknown topic`);
    });
}
