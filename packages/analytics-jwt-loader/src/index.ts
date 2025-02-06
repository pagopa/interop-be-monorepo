import { SQSClient } from "@aws-sdk/client-sqs/dist-types/SQSClient.js";
import { genericLogger, initFileManager } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { processMessage } from "./messageHandler.js";
import { instantiateClient, runConsumer } from "./sqs/sqs.js";

const sqsClient: SQSClient = instantiateClient({
  region: config.awsRegion,
  endpoint: config.queueUrl,
});

const fileManager = initFileManager(config);

await runConsumer(
  sqsClient,
  {
    queueUrl: config.queueUrl,
    consumerPollingTimeout: config.consumerPollingTimeout,
    serviceName: config.serviceName,
    runUntilQueueIsEmpty: config.runUntilQueueIsEmpty,
  },
  processMessage(config.queueUrl, fileManager, genericLogger)
);
