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
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { config } from "../config/config.js";
import { handleAgreementMessageV2 } from "./handleAgreementMessageV2.js";
import { handleAuthorizationMessageV1 } from "./handleAuthorizationMessageV1.js";
import { handleAuthorizationMessageV2 } from "./handleAuthorizationMessageV2.js";
import { handleCatalogMessageV2 } from "./handleCatalogMessageV2.js";
import { handleDelegationMessageV2 } from "./handleDelegationMessageV2.js";
import { handlePurposeMessageV2 } from "./handlePurposeMessageV2.js";

/**
 * Processes a list of Kafka messages for the specified topic by decoding each message and invoking the corresponding handler.
 *
 * @param {KafkaMessage[]} kafkaMessages - An array of Kafka messages belonging to the given topic.
 * @param {string} topic - The Kafka topic from which the messages originate.
 * @param {Logger} logger - The logger instance for logging messages.
 * @param {FileManager} fileManager - The file manager responsible for storing s3 files.
 * @param {DbServiceBuilder} dbService - The database service builder with dynamo configs.
 * @param {SafeStorageService} safeStorageService - The safe storage api client.
 * @returns {Promise<void>} A promise that resolves when all messages have been processed.
 * @throws {Error} If the topic is unknown.
 */
// eslint-disable-next-line max-params
export async function executeTopicHandler(
  kafkaMessages: KafkaMessage[],
  topic: string,
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorageService: SafeStorageService
): Promise<void> {
  await match(topic)
    .with(config.catalogTopic, async () => {
      const eserviceV2WithTimestamp: Array<{
        eserviceV2: EServiceEventEnvelopeV2;
        timestamp: string;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, EServiceEvent);
        match(decoded)
          .with({ event_version: 1 }, () => {})
          .with({ event_version: 2 }, (msg) =>
            eserviceV2WithTimestamp.push({
              eserviceV2: msg,
              timestamp: message.timestamp,
            })
          )
          .exhaustive();
      }
      if (eserviceV2WithTimestamp.length > 0) {
        await handleCatalogMessageV2(
          eserviceV2WithTimestamp,
          logger,
          fileManager,
          dbService,
          safeStorageService
        );
      }
    })
    .with(config.agreementTopic, async () => {
      const agreementV2WithTimestamp: Array<{
        agreementV2: AgreementEventEnvelopeV2;
        timestamp: string;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, AgreementEvent);
        match(decoded)
          .with({ event_version: 1 }, () => {})
          .with({ event_version: 2 }, (msg) =>
            agreementV2WithTimestamp.push({
              agreementV2: msg,
              timestamp: message.timestamp,
            })
          )
          .exhaustive();
      }
      if (agreementV2WithTimestamp.length > 0) {
        await handleAgreementMessageV2(
          agreementV2WithTimestamp,
          logger,
          fileManager,
          dbService,
          safeStorageService
        );
      }
    })
    .with(config.purposeTopic, async () => {
      const purposeV2WithTimestamp: Array<{
        purposeV2: PurposeEventEnvelopeV2;
        timestamp: string;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, PurposeEvent);
        match(decoded)
          .with({ event_version: 1 }, () => {})
          .with({ event_version: 2 }, (msg) =>
            purposeV2WithTimestamp.push({
              purposeV2: msg,
              timestamp: message.timestamp,
            })
          )
          .exhaustive();
      }
      if (purposeV2WithTimestamp.length > 0) {
        await handlePurposeMessageV2(
          purposeV2WithTimestamp,
          logger,
          fileManager,
          dbService,
          safeStorageService
        );
      }
    })
    .with(config.authorizationTopic, async () => {
      const authV1WithTimestamp: Array<{
        authV1: AuthorizationEventEnvelopeV1;
        timestamp: string;
      }> = [];
      const authV2WithTimestamp: Array<{
        authV2: AuthorizationEventEnvelopeV2;
        timestamp: string;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, AuthorizationEvent);
        match(decoded)
          .with({ event_version: 1 }, (msg) =>
            authV1WithTimestamp.push({
              authV1: msg,
              timestamp: message.timestamp,
            })
          )
          .with({ event_version: 2 }, (msg) =>
            authV2WithTimestamp.push({
              authV2: msg,
              timestamp: message.timestamp,
            })
          )
          .exhaustive();
      }
      if (authV1WithTimestamp.length > 0) {
        await handleAuthorizationMessageV1(
          authV1WithTimestamp,
          logger,
          fileManager,
          dbService,
          safeStorageService
        );
      }
      if (authV2WithTimestamp.length > 0) {
        await handleAuthorizationMessageV2(
          authV2WithTimestamp,
          logger,
          fileManager,
          dbService,
          safeStorageService
        );
      }
    })
    .with(config.delegationTopic, async () => {
      const delegationV2WithTimestamp: Array<{
        delegationV2: DelegationEventEnvelopeV2;
        timestamp: string;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, DelegationEvent);
        match(decoded)
          .with({ event_version: 2 }, (msg) =>
            delegationV2WithTimestamp.push({
              delegationV2: msg,
              timestamp: message.timestamp,
            })
          )
          .exhaustive();
      }
      if (delegationV2WithTimestamp.length > 0) {
        await handleDelegationMessageV2(
          delegationV2WithTimestamp,
          logger,
          fileManager,
          dbService,
          safeStorageService
        );
      }
    })
    .otherwise(() => {
      throw genericInternalError(`Unknown topic`);
    });
}
