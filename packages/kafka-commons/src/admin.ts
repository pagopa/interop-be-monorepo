import type { Kafka } from "@confluentinc/kafka-javascript/types/kafkajs.js";
import { Logger } from "pagopa-interop-commons";

// fetchTopicMetadata({ topics }) times out with OAUTHBEARER/SASL_SSL when
// called as the first admin operation. Admin ops need the controller broker,
// which is only known after a metadata fetch — but with OAUTHBEARER the
// background metadata refresh hasn't completed yet. `listTopics()` in
// `initKafkaAdmin` forces a metadata fetch first, populating the controller cache.
export async function checkTopicsExist(
  kafka: Kafka,
  topicNames: string[],
  logger: Logger
): Promise<boolean> {
  logger.debug(`Check topics [${topicNames}] existence...`);

  const admin = await initKafkaAdmin(kafka);

  try {
    await admin.fetchTopicMetadata({
      topics: [...topicNames],
    });
    logger.debug("Topic metadata fetched successfully");
    return true;
  } catch (e) {
    logger.error(
      `Unable to subscribe to topics "${topicNames}": topic metadata fetch failed. Error: ${JSON.stringify(e)}`
    );
    return false;
  } finally {
    await admin.disconnect();
  }
}

export async function initKafkaAdmin(kafka: Kafka) {
  const admin = kafka.admin();
  await admin.connect();
  // Populate controller broker cache via rd_kafka_metadata — without this,
  // admin operations (describeTopics) time out with OAUTHBEARER/SASL_SSL.
  await admin.listTopics({ timeout: 10000 });
  return admin;
}
