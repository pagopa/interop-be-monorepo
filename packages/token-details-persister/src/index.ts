import { EachMessagePayload } from "kafkajs";
import { initFileManager, genericLogger } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { config } from "./config/config.js";
import { handleMessage } from "./consumerService.js";

const fileManager = initFileManager(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  // const decodedMessage = decodeKafkaMessage(message, EServiceEvent);

  const loggerInstance = genericLogger;
  // const loggerInstance = logger({
  //   serviceName: "token-details-persister",
  //   eventType: decodedMessage.type,
  //   eventVersion: decodedMessage.event_version,
  //   streamId: decodedMessage.stream_id,
  //   correlationId: decodedMessage.correlation_id,
  // });

  await handleMessage(message, fileManager);

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, ["TODO config.topicName"], processMessage);
