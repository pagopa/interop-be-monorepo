import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { match } from "ts-pattern";
import { config, safeStorageApiConfig } from "./config/config.js";
import { AgreementEventV2, CorrelationId, DelegationEventV2, generateId, genericInternalError, PurposeEventV2, unsafeBrandId } from "pagopa-interop-models";
import { AgreementTopicConfig, decodeKafkaMessage, DelegationTopicConfig, initFileManager, logger, Logger, PurposeTopicConfig } from "pagopa-interop-commons";
import { handleAgreementContract } from "./handlers/handleAgreementContract.js";
import { createSafeStorageApiClient } from "./services/safeStorageService.js";
import { dbServiceBuilder } from "./services/dbService.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";


const fileManager = initFileManager(config);
const dynamoDBClient = new DynamoDBClient();
const dbService = dbServiceBuilder(dynamoDBClient);
const safeStorageService = createSafeStorageApiClient(safeStorageApiConfig);


function processMessage(
  agreementTopicConfig: AgreementTopicConfig,
  delegationTopicConfig: DelegationTopicConfig,
  purposeTopicConfig: PurposeTopicConfig,
) {
  
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    match(messagePayload.topic)
      .with(agreementTopicConfig.agreementTopic, () => {
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

        handleAgreementContract(decodedMessage, dbService, safeStorageService, fileManager, loggerInstance);
      })
    .with(delegationTopicConfig.delegationTopic, () => {
        const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            DelegationEventV2
          );
          

    })  
    .with(purposeTopicConfig.purposeTopic, ( => {
        const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            PurposeEventV2
          );
    })).otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
    });
  
}

}

await runConsumer(
  config,
  [config.agreementTopic, config.delegationTopic, config.purposeTopic],
  processMessage(
      {agreementTopic: config.agreementTopic},
      {delegationTopic: config.delegationTopic},
      {purposeTopic: config.purposeTopic}
    ),
  "documents-signer"
);
