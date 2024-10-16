import { EachBatchPayload } from "kafkajs";
import { initFileManager, genericLogger } from "pagopa-interop-commons";
import { runBatchConsumer } from "kafka-iam-auth";
import {
  GeneratedTokenAuditDetails,
  genericInternalError,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "./config/config.js";
import { handleMessages } from "./consumerService.js";

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

  const messages = z
    .array(GeneratedTokenAuditDetails)
    .safeParse(batch.messages);
  if (!messages.success) {
    throw genericInternalError(`Unable to parse auditing entries: ${messages}`);
  }
  await handleMessages(messages.data, fileManager, loggerInstance);

  loggerInstance.info(
    `Auditing message was handled. Partition number: ${batch.partition}. Offset: ${batch.firstOffset} -  ${batch.lastOffset}`
  );
}

await runBatchConsumer(config, [config.s3Bucket], processMessage);
