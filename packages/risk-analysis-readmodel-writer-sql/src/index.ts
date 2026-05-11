import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  CorrelationId,
  generateId,
  RiskAnalysisEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { handleMessageV2 } from "./riskAnalysisConsumerServiceV2.js";
import { config } from "./config/config.js";
import { riskAnalysisWriterServiceBuilder } from "./riskAnalysisWriterService.js";

const db = makeDrizzleConnection(config);
const riskAnalysisWriterService = riskAnalysisWriterServiceBuilder(db);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, RiskAnalysisEvent);

  const loggerInstance = logger({
    serviceName: "risk-analysis-readmodel-writer-sql",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });

  await handleMessageV2(decodedMessage, riskAnalysisWriterService);

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(
  config,
  [config.riskAnalysisTopic],
  processMessage,
  "risk-analysis-readmodel-writer-sql"
);
