/* eslint-disable functional/immutable-data */
import { EachBatchPayload, EachMessagePayload } from "kafkajs";
import { genericLogger, logger } from "pagopa-interop-commons";

import { runBatchConsumer } from "kafka-iam-auth";
import {
  baseConsumerConfig,
  config,
  batchConsumerConfig,
} from "./config/config.js";
import { DBContext, initDB } from "./db/db.js";
import { setupDbServiceBuilder } from "./service/setupDbService.js";
import { retryConnection } from "./db/buildColumnSet.js";
import { AttributeDbtable } from "./model/db.js";
import { handleTopicMessages } from "./handlers/messageHandler.js";
const dbInstance = initDB({
  username: config.dbUsername,
  password: config.dbPassword,
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
  useSSL: config.dbUseSSL,
  maxConnectionPool: config.dbMaxConnectionPool,
});

const connection = await dbInstance.connect();
const dbContext: DBContext = {
  conn: connection,
  pgp: dbInstance.$config.pgp,
};

await retryConnection(
  dbInstance,
  dbContext,
  config,
  async (db) => {
    await setupDbServiceBuilder(db.conn, config).setupStagingTables([
      AttributeDbtable.attribute,
    ]);
    await setupDbServiceBuilder(
      db.conn,
      config
    ).setupStagingDeletingByIdTables();
  },
  logger({ serviceName: config.serviceName })
);

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function processBatch({
  batch,
  heartbeat,
  pause,
}: EachBatchPayload): Promise<void> {
  const payloads: EachMessagePayload[] = batch.messages.map((message) => ({
    topic: batch.topic,
    partition: batch.partition,
    heartbeat,
    pause,
    message,
  }));

  const promises = await handleTopicMessages(payloads, dbContext);
  await Promise.allSettled(promises);

  genericLogger.info(
    `Handled batch. Partition: ${
      batch.partition
    }. Offsets: ${batch.firstOffset()} -> ${batch.lastOffset()}`
  );
}

await runBatchConsumer(
  baseConsumerConfig,
  batchConsumerConfig,
  [
    config.attributeTopic,
    // config.agreementTopic,
    // config.catalogTopic,
    // config.purposeTopic,
    // config.tenantTopic,
    // config.delegationTopic,
    // config.authorizationTopic,
    // config.eserviceTemplateTopic,
  ],
  processBatch
);
