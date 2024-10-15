import { EachBatchPayload } from "kafkajs";
import { initFileManager, genericLogger } from "pagopa-interop-commons";
import { runConsumerBatch } from "kafka-iam-auth";
import { config } from "./config/config.js";
import { handleBatch } from "./consumerService.js";

const fileManager = initFileManager(config);

async function processMessage({ batch }: EachBatchPayload): Promise<void> {
  // const decodedMessage = decodeKafkaMessage(message, EServiceEvent);

  const loggerInstance = genericLogger;
  // const loggerInstance = logger({
  //   serviceName: "token-details-persister",
  //   eventType: decodedMessage.type,
  //   eventVersion: decodedMessage.event_version,
  //   streamId: decodedMessage.stream_id,
  //   correlationId: decodedMessage.correlation_id,
  // });

  await handleBatch(batch, fileManager, loggerInstance);

  loggerInstance.info(
    `Auditing message was handled. Partition number: ${batch.partition}. Offset: ${batch.firstOffset} -  ${batch.lastOffset}`
  );
}

await runConsumerBatch(
  config,
  [config.interopGeneratedJwtAuditingBucket],
  processMessage
);
