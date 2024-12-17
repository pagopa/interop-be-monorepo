import { EachBatchPayload } from "kafkajs";
import { initFileManager, logger } from "pagopa-interop-commons";
import { runBatchConsumer } from "kafka-iam-auth";
import { config } from "./config/config.js";
import { handleMessages } from "./consumerService.js";

const fileManager = initFileManager(config);
const loggerInstance = logger({
  serviceName: "token-details-persister",
});

async function processMessage({ batch }: EachBatchPayload): Promise<void> {
  await handleMessages(batch.messages, fileManager, loggerInstance);

  loggerInstance.info(
    `Handling audit messages. Partition number: ${
      batch.partition
    }. Offset: ${batch.firstOffset()} -> ${batch.lastOffset()}`
  );
}

await runBatchConsumer(config, [config.tokenAuditingTopic], processMessage);
