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

// eslint-disable-next-line max-params
function processMessage(
  authorizationTopicConfig: AuthorizationTopicConfig,
  agreementTopicConfig: AgreementTopicConfig,
  purposeTopicConfig: PurposeTopicConfig,
  delegationTopic: DelegationTopicConfig,
  catalogTopicConfig: CatalogTopicConfig,
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    const { decodedMessage } = match(messagePayload.topic)
      .with(catalogTopicConfig.catalogTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          EServiceEventV2,
        );

        return { decodedMessage };
      })
      .with(agreementTopicConfig.agreementTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          AgreementEventV2,
        );

        return { decodedMessage };
      })
      .with(purposeTopicConfig.purposeTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          PurposeEventV2,
        );
        return { decodedMessage };
      })
      .with(authorizationTopicConfig.authorizationTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          AuthorizationEventV2,
        );
        return { decodedMessage };
      })
      .with(delegationTopic.delegationTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          DelegationEventV2,
        );
        return { decodedMessage };
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
      `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`,
    );
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
        authorizationTopic: config.authorizationTopic,
      },
      {
        agreementTopic: config.agreementTopic,
      },
      {
        purposeTopic: config.purposeTopic,
      },
      {
        delegationTopic: config.delegationTopic,
      },
      {
        catalogTopic: config.catalogTopic,
      },
    ),
    "events-signer",
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
