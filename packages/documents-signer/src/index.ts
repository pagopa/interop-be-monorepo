import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { match } from "ts-pattern";
import {
  AgreementEventV2,
  CorrelationId,
  DelegationEventV2,
  generateId,
  genericInternalError,
  PurposeEventV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  AgreementTopicConfig,
  decodeKafkaMessage,
  DelegationTopicConfig,
  initFileManager,
  logger,
  PurposeTopicConfig,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { config, safeStorageApiConfig } from "./config/config.js";
import { createSafeStorageApiClient } from "./services/safeStorageService.js";
import { dbServiceBuilder } from "./services/dbService.js";
import { handleAgreementDocument } from "./handlers/handleAgreementDocument.js";
import { handleDelegationDocument } from "./handlers/handleDelegationDocument.js";
import { handlePurposeDocument } from "./handlers/handlePurposeDocument.js";

const fileManager = initFileManager({
  ...config,
  s3CustomServer: false,
});
const dynamoDBClient = new DynamoDBClient();
const dbService = dbServiceBuilder(dynamoDBClient);
const safeStorageService = createSafeStorageApiClient(safeStorageApiConfig);

function processMessage(
  agreementTopicConfig: AgreementTopicConfig,
  delegationTopicConfig: DelegationTopicConfig,
  purposeTopicConfig: PurposeTopicConfig
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    await match(messagePayload.topic)
      .with(agreementTopicConfig.agreementTopic, async () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          AgreementEventV2
        );

        const loggerInstance = logger({
          serviceName: "documents-signer",
          eventType: decodedMessage.type,
          eventVersion: decodedMessage.event_version,
          streamId: decodedMessage.stream_id,
          streamVersion: decodedMessage.version,
          correlationId: decodedMessage.correlation_id
            ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
            : generateId<CorrelationId>(),
        });

        await handleAgreementDocument(
          decodedMessage,
          dbService,
          safeStorageService,
          fileManager,
          loggerInstance
        );
      })
      .with(delegationTopicConfig.delegationTopic, async () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          DelegationEventV2
        );
        const loggerInstance = logger({
          serviceName: "documents-signer",
          eventType: decodedMessage.type,
          eventVersion: decodedMessage.event_version,
          streamId: decodedMessage.stream_id,
          streamVersion: decodedMessage.version,
          correlationId: decodedMessage.correlation_id
            ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
            : generateId<CorrelationId>(),
        });

        await handleDelegationDocument(
          decodedMessage,
          dbService,
          safeStorageService,
          fileManager,
          loggerInstance
        );
      })
      .with(purposeTopicConfig.purposeTopic, async () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          PurposeEventV2
        );
        const loggerInstance = logger({
          serviceName: "documents-signer",
          eventType: decodedMessage.type,
          eventVersion: decodedMessage.event_version,
          streamId: decodedMessage.stream_id,
          streamVersion: decodedMessage.version,
          correlationId: decodedMessage.correlation_id
            ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
            : generateId<CorrelationId>(),
        });
        await handlePurposeDocument(
          decodedMessage,
          dbService,
          safeStorageService,
          fileManager,
          loggerInstance
        );
      })
      .otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
      });
  };
}

await runConsumer(
  config,
  [config.agreementTopic, config.delegationTopic, config.purposeTopic],
  processMessage(
    { agreementTopic: config.agreementTopic },
    { delegationTopic: config.delegationTopic },
    { purposeTopic: config.purposeTopic }
  ),
  "documents-signer"
);
