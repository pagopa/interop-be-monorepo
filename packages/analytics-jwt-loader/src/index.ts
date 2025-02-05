import { SQSClient } from "@aws-sdk/client-sqs/dist-types/SQSClient.js";
import { config } from "./config/config.js";
import { processMessage } from "./messageHandler.js";
import { instantiateClient, runConsumer } from "./sqs/sqs.js";

const sqsClient: SQSClient = instantiateClient({
  region: config.awsRegion,
  endpoint: config.queueUrl,
});

await runConsumer(
  sqsClient,
  {
    queueUrl: config.queueUrl,
    consumerPollingTimeout: config.consumerPollingTimeout,
    serviceName: config.serviceName,
    logLevel: config.logLevel,
    awsRegion: config.awsRegion,
  },
  processMessage()
);
