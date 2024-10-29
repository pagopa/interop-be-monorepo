import { EachBatchPayload } from "kafkajs";
import { initFileManager, logger } from "pagopa-interop-commons";
import { runBatchConsumer } from "kafka-iam-auth";
import {
  GeneratedTokenAuditDetails,
  genericInternalError,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "./config/config.js";
import { handleMessages } from "./consumerService.js";

const fileManager = initFileManager(config);
const loggerInstance = logger({
  serviceName: "token-details-persister",
});

async function processMessage({ batch }: EachBatchPayload): Promise<void> {
  const messages = z
    .array(GeneratedTokenAuditDetails)
    .safeParse(batch.messages);
  if (!messages.success) {
    throw genericInternalError(`Unable to parse auditing entries: ${messages}`);
  }
  await handleMessages(messages.data, fileManager, loggerInstance);

  loggerInstance.info(
    `Auditing message was handled. Partition number: ${batch.partition}. Offset: ${batch.firstOffset} ->  ${batch.lastOffset}`
  );
}

await runBatchConsumer(config, [config.tokenAuditingTopic], processMessage);
