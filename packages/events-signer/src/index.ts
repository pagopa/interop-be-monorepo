/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  CatalogTopicConfig,
  genericLogger,
  AgreementTopicConfig,
  PurposeTopicConfig,
  AuthorizationTopicConfig,
  DelegationTopicConfig,
  decodeKafkaMessage,
  initFileManager,
} from "pagopa-interop-commons";
import {
  genericInternalError,
  unsafeBrandId,
  CorrelationId,
  generateId,
  EServiceEventV2,
  AgreementEventV2,
  PurposeEventV2,
  AuthorizationEventV2,
  DelegationEventV2,
} from "pagopa-interop-models";

import { config } from "../config/config.js";

import { handleCatalogMessageV2 } from "./handlers/handleCatalogMessageV2.js";
import { handleAgreementMessageV2 } from "./handlers/handleAgreementMessageV2.js";
import { handlePurposeMessageV2 } from "./handlers/handlePurposeMessageV2.js";
import { handleAuthorizationMessageV2 } from "./handlers/handleAuthorizationMessageV2.js";
import { handleDelegationMessageV2 } from "./handlers/handleDelegationMessageV2.js";

const fileManager = initFileManager(config);

function processMessage(
  catalogTopicConfig: CatalogTopicConfig,
  agreementTopicConfig: AgreementTopicConfig,
  purposeTopicConfig: PurposeTopicConfig,
  authorizationTopicConfig: AuthorizationTopicConfig,
  delegationTopicConfig: DelegationTopicConfig
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    const { decodedMessage, updater } = match(messagePayload.topic)
      .with(catalogTopicConfig.catalogTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          EServiceEventV2
        );

        const updater = handleCatalogMessageV2.bind(null, decodedMessage);

        return { decodedMessage, updater };
      })
      .with(agreementTopicConfig.agreementTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          AgreementEventV2
        );

        const updater = handleAgreementMessageV2.bind(null, decodedMessage);

        return { decodedMessage, updater };
      })
      .with(purposeTopicConfig.purposeTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          PurposeEventV2
        );

        const updater = handlePurposeMessageV2.bind(null, decodedMessage);

        return { decodedMessage, updater };
      })
      .with(authorizationTopicConfig.authorizationTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          AuthorizationEventV2
        );

        const updater = handleAuthorizationMessageV2.bind(null, decodedMessage);

        return { decodedMessage, updater };
      })
      .with(delegationTopicConfig.delegationTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          DelegationEventV2
        );

        const updater = handleDelegationMessageV2.bind(null, decodedMessage);

        return { decodedMessage, updater };
      })
      .otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
      });

    const correlationId: CorrelationId = decodedMessage.correlation_id
      ? unsafeBrandId(decodedMessage.correlation_id)
      : generateId();

    const loggerInstance = logger({
      serviceName: "events-signer",
      eventType: decodedMessage.type,
      eventVersion: decodedMessage.event_version,
      streamId: decodedMessage.stream_id,
      streamVersion: decodedMessage.version,
      correlationId,
    });

    loggerInstance.info(
      `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
    );

    await updater(loggerInstance, fileManager);
  };
}

try {
  await runConsumer(
    config,
    [
      config.authorizationTopic,
      config.agreementTopic,
      config.purposeTopic,
      config.delegationTopic,
      config.catalogTopic,
    ],
    processMessage(
      {
        catalogTopic: config.catalogTopic,
      },
      {
        agreementTopic: config.agreementTopic,
      },
      {
        purposeTopic: config.purposeTopic,
      },
      {
        authorizationTopic: config.authorizationTopic,
      },
      {
        delegationTopic: config.delegationTopic,
      }
    ),
    "events-signer"
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
