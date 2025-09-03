/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  AgreementTopicConfig,
  DelegationTopicConfig,
  PurposeTopicConfig,
  decodeKafkaMessage,
  genericLogger,
  logger,
} from "pagopa-interop-commons";

import {
  AgreementEventV2,
  PurposeEventV2,
  genericInternalError,
  CorrelationId,
  unsafeBrandId,
  generateId,
  DelegationEventV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { baseConsumerConfig, config } from "./config/config.js";
import { handlePurposeMessageV2 } from "./handler/handlePurposeMessageV2.js";
import { handleDelegationMessageV2 } from "./handler/handleDelegationMessageV2.js";
import { handleAgreementMessageV2 } from "./handler/handleAgreementMessageV2.js";

function processMessage(
  agreementTopicConfig: AgreementTopicConfig,
  purposeTopicConfig: PurposeTopicConfig,
  delegationTopicConfig: DelegationTopicConfig
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    const { decodedMessage, updater } = match(messagePayload.topic)
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
      serviceName: "authorization-updater",
      eventType: decodedMessage.type,
      eventVersion: decodedMessage.event_version,
      streamId: decodedMessage.stream_id,
      streamVersion: decodedMessage.version,
      correlationId,
    });

    loggerInstance.info(
      `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
    );

    await updater(loggerInstance);
  };
}

try {
  await runConsumer(
    baseConsumerConfig,
    [config.agreementTopic, config.purposeTopic, config.delegationTopic],
    processMessage(
      {
        agreementTopic: config.agreementTopic,
      },
      {
        purposeTopic: config.purposeTopic,
      },
      {
        delegationTopic: config.delegationTopic,
      }
    )
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
