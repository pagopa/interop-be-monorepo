import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { match } from "ts-pattern";
import {
  AgreementEvent,
  CorrelationId,
  DelegationEvent,
  generateId,
  genericInternalError,
  PurposeEvent,
  PurposeTemplateEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  AgreementTopicConfig,
  decodeKafkaMessage,
  DelegationTopicConfig,
  initFileManager,
  logger,
  PurposeTopicConfig,
  createSafeStorageApiClient,
  signatureServiceBuilder,
  PurposeTemplateTopicConfig,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { config } from "./config/config.js";
import { handleAgreementDocument } from "./handlers/handleAgreementDocument.js";
import { handleDelegationDocument } from "./handlers/handleDelegationDocument.js";
import { handlePurposeDocument } from "./handlers/handlePurposeDocument.js";
import { handlePurposeTemplateDocument } from "./handlers/handlePurposeTemplateDocument.js";

const fileManager = initFileManager({
  ...config,
  s3CustomServer: false,
});
const dynamoDBClient = new DynamoDBClient();
const signatureService = signatureServiceBuilder(dynamoDBClient, config);
const safeStorageService = createSafeStorageApiClient(config);

function processMessage(
  agreementTopicConfig: AgreementTopicConfig,
  delegationTopicConfig: DelegationTopicConfig,
  purposeTopicConfig: PurposeTopicConfig,
  purposeTemplateTopicConfig: PurposeTemplateTopicConfig
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    await match(messagePayload.topic)
      .with(agreementTopicConfig.agreementTopic, async () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          AgreementEvent
        );

        await match(decodedMessage)
          .with({ event_version: 1 }, () => Promise.resolve())
          .with({ event_version: 2 }, async (msg) => {
            const loggerInstance = logger({
              serviceName: "documents-signer",
              eventType: msg.type,
              eventVersion: msg.event_version,
              streamId: msg.stream_id,
              streamVersion: msg.version,
              correlationId: msg.correlation_id
                ? unsafeBrandId<CorrelationId>(msg.correlation_id)
                : generateId<CorrelationId>(),
            });

            await handleAgreementDocument(
              msg,
              signatureService,
              safeStorageService,
              fileManager,
              loggerInstance
            );
          })
          .exhaustive();
      })
      .with(delegationTopicConfig.delegationTopic, async () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          DelegationEvent
        );

        await match(decodedMessage)
          .with({ event_version: 2 }, async (msg) => {
            const loggerInstance = logger({
              serviceName: "documents-signer",
              eventType: msg.type,
              eventVersion: msg.event_version,
              streamId: msg.stream_id,
              streamVersion: msg.version,
              correlationId: msg.correlation_id
                ? unsafeBrandId<CorrelationId>(msg.correlation_id)
                : generateId<CorrelationId>(),
            });

            await handleDelegationDocument(
              msg,
              signatureService,
              safeStorageService,
              fileManager,
              loggerInstance
            );
          })
          .exhaustive();
      })
      .with(purposeTopicConfig.purposeTopic, async () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          PurposeEvent
        );

        await match(decodedMessage)
          .with({ event_version: 1 }, () => Promise.resolve())
          .with({ event_version: 2 }, async (msg) => {
            const loggerInstance = logger({
              serviceName: "documents-signer",
              eventType: msg.type,
              eventVersion: msg.event_version,
              streamId: msg.stream_id,
              streamVersion: msg.version,
              correlationId: msg.correlation_id
                ? unsafeBrandId<CorrelationId>(msg.correlation_id)
                : generateId<CorrelationId>(),
            });

            await handlePurposeDocument(
              msg,
              signatureService,
              safeStorageService,
              fileManager,
              loggerInstance
            );
          })
          .exhaustive();
      })
      .with(purposeTemplateTopicConfig.purposeTemplateTopic, async () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          PurposeTemplateEvent
        );

        await match(decodedMessage)
          .with({ event_version: 2 }, async (msg) => {
            const loggerInstance = logger({
              serviceName: "documents-signer",
              eventType: msg.type,
              eventVersion: msg.event_version,
              streamId: msg.stream_id,
              streamVersion: msg.version,
              correlationId: msg.correlation_id
                ? unsafeBrandId<CorrelationId>(msg.correlation_id)
                : generateId<CorrelationId>(),
            });
            await handlePurposeTemplateDocument(
              msg,
              signatureService,
              safeStorageService,
              fileManager,
              loggerInstance
            );
          })
          .exhaustive();
      })
      .otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
      });
  };
}

await runConsumer(
  config,
  [
    config.agreementTopic,
    config.delegationTopic,
    config.purposeTopic,
    config.purposeTemplateTopic,
  ],
  processMessage(
    { agreementTopic: config.agreementTopic },
    { delegationTopic: config.delegationTopic },
    { purposeTopic: config.purposeTopic },
    { purposeTemplateTopic: config.purposeTemplateTopic }
  ),
  "documents-signer"
);
