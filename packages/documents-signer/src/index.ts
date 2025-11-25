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
  createSafeStorageApiClient,
  signatureServiceBuilder,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { config } from "./config/config.js";
import { handleAgreementDocument } from "./handlers/handleAgreementDocument.js";
import { handleDelegationDocument } from "./handlers/handleDelegationDocument.js";
import { handlePurposeDocument } from "./handlers/handlePurposeDocument.js";

const fileManager: ReturnType<typeof initFileManager> = initFileManager({
  // eslint-disable-next-line local-rules/no-unsafe-object-spread
  ...config,
  s3CustomServer: false,
});
const dynamoDBClient = new DynamoDBClient();
const signatureService = signatureServiceBuilder(dynamoDBClient, config);
const safeStorageService = createSafeStorageApiClient(config);

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
          signatureService,
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
          signatureService,
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
          signatureService,
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
