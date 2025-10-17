/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  AgreementTopicConfig,
  DelegationTopicConfig,
  InteropTokenGenerator,
  PurposeTopicConfig,
  RefreshableInteropToken,
  decodeKafkaMessage,
  genericLogger,
  initFileManager,
  initPDFGenerator,
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
import {
  agreementReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { baseConsumerConfig, config } from "./config/config.js";
import { handlePurposeMessageV2 } from "./handler/handlePurposeMessageV2.js";
import { handleDelegationMessageV2 } from "./handler/handleDelegationMessageV2.js";
import { handleAgreementMessageV2 } from "./handler/handleAgreementMessageV2.js";
import { readModelServiceBuilderSQL } from "./service/readModelSql.js";

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);
await refreshableToken.init();
const fileManager = initFileManager(config);
const pdfGenerator = await initPDFGenerator();

const readModelDB = makeDrizzleConnection(config);

const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  attributeReadModelServiceSQL,
  delegationReadModelServiceSQL,
});

function processMessage(
  agreementTopicConfig: AgreementTopicConfig,
  purposeTopicConfig: PurposeTopicConfig,
  delegationTopicConfig: DelegationTopicConfig
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    const { decodedMessage, documentGenerator } = match(messagePayload.topic)
      .with(agreementTopicConfig.agreementTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          AgreementEventV2
        );

        const documentGenerator = handleAgreementMessageV2.bind(
          null,
          decodedMessage,
          pdfGenerator,
          fileManager,
          readModelServiceSQL,
          refreshableToken
        );

        return { decodedMessage, documentGenerator };
      })
      .with(purposeTopicConfig.purposeTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          PurposeEventV2
        );

        const documentGenerator = handlePurposeMessageV2.bind(
          null,
          decodedMessage,
          pdfGenerator,
          fileManager,
          readModelServiceSQL,
          refreshableToken
        );

        return { decodedMessage, documentGenerator };
      })
      .with(delegationTopicConfig.delegationTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          messagePayload.message,
          DelegationEventV2
        );

        const documentGenerator = handleDelegationMessageV2.bind(
          null,
          decodedMessage,
          pdfGenerator,
          fileManager,
          readModelServiceSQL,
          refreshableToken
        );

        return { decodedMessage, documentGenerator };
      })
      .otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
      });

    const correlationId: CorrelationId = decodedMessage.correlation_id
      ? unsafeBrandId(decodedMessage.correlation_id)
      : generateId();

    const loggerInstance = logger({
      serviceName: "documents-generator",
      eventType: decodedMessage.type,
      eventVersion: decodedMessage.event_version,
      streamId: decodedMessage.stream_id,
      streamVersion: decodedMessage.version,
      correlationId,
    });

    loggerInstance.info(
      `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
    );

    await documentGenerator(loggerInstance);
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
