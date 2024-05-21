import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  agreementTopicConfig,
  decodeKafkaMessage,
  kafkaConsumerConfig,
  logger,
} from "pagopa-interop-commons";
import { AgreementEvent } from "pagopa-interop-models";

const config = kafkaConsumerConfig();
const topicsConfig = agreementTopicConfig();

export async function processMessage({
  message,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, AgreementEvent);
  const loggerInstance = logger({
    serviceName: "agreement-email-sender",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });
  loggerInstance.info(decodedMessage);
}

await runConsumer(config, [topicsConfig.agreementTopic], processMessage);
