import "dotenv-flow/config.js";

import { Kafka, KafkaMessage } from "kafkajs";
import { logger } from "pagopa-interop-commons";
import AWS from "aws-sdk";
import { decodeKafkaMessage } from "./model/models.js";
import { handleMessage } from "./consumerService.js";
import { config } from "./utilities/config.js";

const sts = new AWS.STS();

const assumeRoleResponse = await sts
  .assumeRole({
    RoleArn: "arn:aws:iam::505630707203:role/interop-buildo-developers-dev",
    RoleSessionName: "catalog-consumer-session",
  })
  .promise();

if (!assumeRoleResponse.Credentials || !assumeRoleResponse.AssumedRoleUser) {
  exitGracefully();
}

const accessKey = assumeRoleResponse.Credentials
  ? assumeRoleResponse.Credentials.AccessKeyId
  : "";
const secretKey = assumeRoleResponse.Credentials
  ? assumeRoleResponse.Credentials.SecretAccessKey
  : "";

const roleId = assumeRoleResponse.AssumedRoleUser
  ? assumeRoleResponse.AssumedRoleUser.AssumedRoleId
  : "";

const kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: [config.kafkaBrokers],
  ssl: true,
  sasl: {
    mechanism: "aws",
    authorizationIdentity: roleId,
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
});

const consumer = kafka.consumer({ groupId: config.kafkaGroupId });
await consumer.connect();

function exitGracefully(): void {
  consumer.disconnect().finally(() => {
    logger.info("Consumer disconnected");
    process.exit(0);
  });
}

process.on("SIGINT", exitGracefully);
process.on("SIGTERM", exitGracefully);

await consumer.subscribe({
  topics: ["catalog.public.event"],
});

async function processMessage(message: KafkaMessage): Promise<void> {
  try {
    await handleMessage(decodeKafkaMessage(message));

    logger.info("Read model was updated");
  } catch (e) {
    logger.error(e);
  }
}

await consumer.run({
  eachMessage: ({ message }) => processMessage(message),
});
