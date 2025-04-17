// index.ts
import { initQueueManager, logger } from "pagopa-interop-commons";
import { initProducer } from "kafka-iam-auth";
import { config } from "./config/config.js";
import { handleMessage } from "./handlers/handleMessage.js";

const queueManager = initQueueManager({
  messageGroupId: "message_group_all_notification",
  logLevel: config.logLevel,
});

const processMessage = handleMessage(
  await initProducer(config, config.applicationAuditTopic)
);

await queueManager.runConsumer(
  processMessage,
  logger({ serviceName: config.serviceName }),
  {
    queueUrl: config.consumerQueueUrl,
    maxNumberOfMessages: config.maxNumberOfMessages,
    waitTimeSeconds: config.waitTimeSeconds,
    visibilityTimeout: config.visibilityTimeout,
    serviceName: config.serviceName,
  }
);
