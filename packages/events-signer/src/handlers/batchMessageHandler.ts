/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-empty-function */

import { KafkaMessage } from "kafkajs";
import { FileManager, decodeKafkaMessage } from "pagopa-interop-commons";
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
import {
  SafeStorageService,
  SignatureServiceBuilder,
} from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { getEventTimestamp } from "../utils/eventTimestamp.js";
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
 * @param {SignatureServiceBuilder} signatureService - The database service builder with dynamo configs.
 * @param {SafeStorageService} safeStorageService - The safe storage api client.
 * @returns {Promise<void>} A promise that resolves when all messages have been processed.
 * @throws {Error} If the topic is unknown.
 */
// eslint-disable-next-line max-params
export async function executeTopicHandler(
  kafkaMessages: KafkaMessage[],
  topic: string,
  fileManager: FileManager,
  signatureService: SignatureServiceBuilder,
  safeStorageService: SafeStorageService
): Promise<void> {
  await match(topic)
    .with(config.catalogTopic, async () => {
      const eservicesV2WithTimestamp: Array<{
        eserviceV2: EServiceEventEnvelopeV2;
        timestamp: Date;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, EServiceEvent);
        match(decoded)
          .with({ event_version: 1 }, () => {})
          .with({ event_version: 2 }, (msg) =>
            eservicesV2WithTimestamp.push({
              eserviceV2: msg,
              timestamp: getEventTimestamp(message),
            })
          )
          .exhaustive();
      }
      if (eservicesV2WithTimestamp.length > 0) {
        await handleCatalogMessageV2(
          eservicesV2WithTimestamp,
          fileManager,
          signatureService,
          safeStorageService
        );
      }
    })
    .with(config.agreementTopic, async () => {
      const agreementsV2WithTimestamp: Array<{
        agreementV2: AgreementEventEnvelopeV2;
        timestamp: Date;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, AgreementEvent);
        match(decoded)
          .with({ event_version: 1 }, () => {})
          .with({ event_version: 2 }, (msg) =>
            agreementsV2WithTimestamp.push({
              agreementV2: msg,
              timestamp: getEventTimestamp(message),
            })
          )
          .exhaustive();
      }
      if (agreementsV2WithTimestamp.length > 0) {
        await handleAgreementMessageV2(
          agreementsV2WithTimestamp,
          fileManager,
          signatureService,
          safeStorageService
        );
      }
    })
    .with(config.purposeTopic, async () => {
      const purposesV2WithTimestamp: Array<{
        purposeV2: PurposeEventEnvelopeV2;
        timestamp: Date;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, PurposeEvent);
        match(decoded)
          .with({ event_version: 1 }, () => {})
          .with({ event_version: 2 }, (msg) =>
            purposesV2WithTimestamp.push({
              purposeV2: msg,
              timestamp: getEventTimestamp(message),
            })
          )
          .exhaustive();
      }
      if (purposesV2WithTimestamp.length > 0) {
        await handlePurposeMessageV2(
          purposesV2WithTimestamp,
          fileManager,
          signatureService,
          safeStorageService
        );
      }
    })
    .with(config.authorizationTopic, async () => {
      const authorizationsV1WithTimestamp: Array<{
        authV1: AuthorizationEventEnvelopeV1;
        timestamp: Date;
      }> = [];
      const authorizationsV2WithTimestamp: Array<{
        authV2: AuthorizationEventEnvelopeV2;
        timestamp: Date;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, AuthorizationEvent);
        match(decoded)
          .with({ event_version: 1 }, (msg) =>
            authorizationsV1WithTimestamp.push({
              authV1: msg,
              timestamp: getEventTimestamp(message),
            })
          )
          .with({ event_version: 2 }, (msg) =>
            authorizationsV2WithTimestamp.push({
              authV2: msg,
              timestamp: getEventTimestamp(message),
            })
          )
          .exhaustive();
      }
      if (authorizationsV1WithTimestamp.length > 0) {
        await handleAuthorizationMessageV1(
          authorizationsV1WithTimestamp,
          fileManager,
          signatureService,
          safeStorageService
        );
      }
      if (authorizationsV2WithTimestamp.length > 0) {
        await handleAuthorizationMessageV2(
          authorizationsV2WithTimestamp,
          fileManager,
          signatureService,
          safeStorageService
        );
      }
    })
    .with(config.delegationTopic, async () => {
      const delegationsV2WithTimestamp: Array<{
        delegationV2: DelegationEventEnvelopeV2;
        timestamp: Date;
      }> = [];

      for (const message of kafkaMessages) {
        const decoded = decodeKafkaMessage(message, DelegationEvent);
        match(decoded)
          .with({ event_version: 2 }, (msg) =>
            delegationsV2WithTimestamp.push({
              delegationV2: msg,
              timestamp: getEventTimestamp(message),
            })
          )
          .exhaustive();
      }
      if (delegationsV2WithTimestamp.length > 0) {
        await handleDelegationMessageV2(
          delegationsV2WithTimestamp,
          fileManager,
          signatureService,
          safeStorageService
        );
      }
    })
    .otherwise(() => {
      throw genericInternalError(`Unknown topic`);
    });
}
