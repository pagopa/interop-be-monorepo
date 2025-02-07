import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  genericLogger,
  logger,
} from "pagopa-interop-commons";
import {
  genericInternalError,
  unsafeBrandId,
  generateId,
  CorrelationId,
  kafkaMessageProcessError,
  EServiceEvent,
  AgreementEvent,
  PurposeEvent,
  AuthorizationEvent,
  AttributeEvent,
  DelegationEvent,
  TenantEvent,
} from "pagopa-interop-models";
import { runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import { config } from "./config/config.js";
import { handleCatalogMessageV1 } from "./handlers/catalog/consumerServiceV1.js";
import { handleAgreementMessageV1 } from "./handlers/agreement/consumerServiceV1.js";
import { handleAgreementMessageV2 } from "./handlers/agreement/consumerServiceV2.js";
import { handlePurposeMessageV1 } from "./handlers/purpose/consumerServiceV1.js";
import { handlePurposeMessageV2 } from "./handlers/purpose/consumerServiceV2.js";
import { handleAuthorizationMessageV1 } from "./handlers/authorization/consumerServiceV1.js";
import { handleAuthorizationEventMessageV2 } from "./handlers/authorization/consumerServiceV2.js";
import { handleDelegationMessageV2 } from "./handlers/delegation/consumerServiceV2.js";
import { handleTenantMessageV1 } from "./handlers/tenant/consumerServiceV1.js";
import { handleCatalogMessageV2 } from "./handlers/catalog/consumerServiceV2.js";
import { handleAttributeMessageV1 } from "./handlers/attribute/consumerServiceV1.js";
import { handleTenantMessageV2 } from "./handlers/tenant/consumerServiceV2.js";

export async function processMessage(
  messagePayload: EachMessagePayload,
): Promise<void> {
  const { partition, message } = messagePayload;

  const { decodedMessage, handler } = match(messagePayload.topic)
    .with(config.catalogTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        EServiceEvent,
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleCatalogMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleCatalogMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.agreementTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        AgreementEvent,
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAgreementMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAgreementMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.attributeTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        AttributeEvent,
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAttributeMessageV1.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.purposeTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        PurposeEvent,
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handlePurposeMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handlePurposeMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.tenantTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        TenantEvent,
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleTenantMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleTenantMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.authorizationTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        AuthorizationEvent,
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAuthorizationMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAuthorizationEventMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.delegationTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        DelegationEvent,
      );

      return match(decodedMessage)
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleDelegationMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .otherwise(() => {
      throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
    });

  const correlationId: CorrelationId = decodedMessage.correlation_id
    ? unsafeBrandId(decodedMessage.correlation_id)
    : generateId();

  const loggerInstance = logger({
    serviceName: "domains-analytics-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId,
  });

  loggerInstance.info(
    `Processing ${decodedMessage.type} message - Partition ${partition} - Offset ${message.offset}`,
  );

  await handler();
}

try {
  await runConsumer(
    config,
    [
      config.attributeTopic,
      config.agreementTopic,
      config.catalogTopic,
      config.purposeTopic,
      config.tenantTopic,
      config.delegationTopic,
      config.authorizationTopic,
    ],
    async (payload) => {
      try {
        await processMessage(payload);
      } catch (err) {
        throw kafkaMessageProcessError(
          payload.topic,
          payload.partition,
          payload.message.offset,
          err,
        );
      }
    },
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
