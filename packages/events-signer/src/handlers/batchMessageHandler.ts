/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-empty-function */

import { KafkaMessage } from "kafkajs";
import {
  FileManager,
  Logger,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import {
  EServiceEventEnvelopeV2,
  EServiceEvent,
  AgreementEventEnvelopeV2,
  AgreementEvent,
  PurposeEventEnvelopeV2,
  PurposeEvent,
  AuthorizationEventEnvelopeV1,
  AuthorizationEventEnvelopeV2,
  AuthorizationEvent,
  DelegationEventEnvelopeV2,
  DelegationEvent,
  genericInternalError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { config } from "../config/config.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { handleCatalogMessageV2 } from "./handleCatalogMessageV2.js";
import { handleAgreementMessageV2 } from "./handleAgreementMessageV2.js";
import { handlePurposeMessageV2 } from "./handlePurposeMessageV2.js";
import { handleDelegationMessageV2 } from "./handleDelegationMessageV2.js";
import { handleAuthorizationMessageV2 } from "./handleAuthorizationMessageV2.js";
import { handleAuthorizationMessageV1 } from "./handleAuthorizationMessageV1.js";

/**
 * Processes a list of Kafka messages for the specified topic by decoding each message and invoking the corresponding handler.
 *
 * @param {KafkaMessage[]} kafkaMessages - An array of Kafka messages belonging to the given topic.
 * @param {string} topic - The Kafka topic from which the messages originate.
 * @param {Logger} logger - The logger instance for logging messages.
 * @param {FileManager} fileManager - The file manager responsible for storing s3 files.
 * @param {DbServiceBuilder} dbService - The database service builder with dynamo configs.
 * @returns {Promise<void>} A promise that resolves when all messages have been processed.
 * @throws {Error} If the topic is unknown.
 */
export async function executeTopicHandler(
  kafkaMessages: KafkaMessage[],
  topic: string,
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder
): Promise<void> {
  await match(topic)
    .with(config.catalogTopic, async () => {
      const eserviceV2: EServiceEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, EServiceEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 1 }, () => {})
          .with({ event_version: 2 }, (msg) => eserviceV2.push(msg))
          .exhaustive();
      }
      if (eserviceV2.length > 0) {
        await handleCatalogMessageV2(
          eserviceV2,
          logger,
          fileManager,
          dbService
        );
      }
    })
    .with(config.agreementTopic, async () => {
      const agreementV2: AgreementEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, AgreementEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 1 }, () => {})
          .with({ event_version: 2 }, (msg) => agreementV2.push(msg))
          .exhaustive();
      }
      if (agreementV2.length > 0) {
        await handleAgreementMessageV2(
          agreementV2,
          logger,
          fileManager,
          dbService
        );
      }
    })
    .with(config.purposeTopic, async () => {
      const purposeV2: PurposeEventEnvelopeV2[] = [];
      const decodedMessages = kafkaMessages.map((message) =>
        decodeKafkaMessage(message, PurposeEvent)
      );
      for (const decoded of decodedMessages) {
        match(decoded)
          .with({ event_version: 1 }, () => {})
          .with({ event_version: 2 }, (msg) => purposeV2.push(msg))
          .exhaustive();
      }
      if (purposeV2.length > 0) {
        await handlePurposeMessageV2(purposeV2, logger, fileManager, dbService);
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
        await handleAuthorizationMessageV1(
          authV1,
          logger,
          fileManager,
          dbService
        );
      }
      if (authV2.length > 0) {
        await handleAuthorizationMessageV2(
          authV2,
          logger,
          fileManager,
          dbService
        );
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
        await handleDelegationMessageV2(
          delegationV2,
          logger,
          fileManager,
          dbService
        );
      }
    })
    .otherwise(() => {
      throw genericInternalError(`Unknown topic`);
    });
}
