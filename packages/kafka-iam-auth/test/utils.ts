import { randomUUID } from "crypto";
import { Admin, Kafka, logLevel } from "kafkajs";
import {
  KafkaBatchConsumerConfig,
  KafkaConsumerConfig,
} from "pagopa-interop-commons";
import { inject } from "vitest";

const kafkaBrokers = inject("kafkaBrokers");

// Plain client for test-side production and assertions.
// It is independent from the module under test.
export const testKafka = new Kafka({
  clientId: "kafka-iam-auth-test",
  brokers: kafkaBrokers,
  logLevel: logLevel.NOTHING,
});

export const consumerConfig = (groupId: string): KafkaConsumerConfig => ({
  awsRegion: "eu-south-1",
  kafkaBrokers,
  kafkaClientId: `test-client-${randomUUID()}`,
  kafkaDisableAwsIamAuth: true,
  kafkaLogLevel: logLevel.NOTHING,
  kafkaReauthenticationThreshold: 20000,
  kafkaBrokerConnectionString: undefined,
  kafkaGroupId: groupId,
  topicStartingOffset: "earliest",
  resetConsumerOffsets: false,
});

// The derived sessionTimeout of the production config formula is below the
// broker minimum for a small maxWait, so the test sets it directly.
export const batchConfig: KafkaBatchConsumerConfig = {
  minBytes: 1,
  maxBytes: 10485760,
  maxWaitKafkaBatchMillis: 500,
  sessionTimeoutMillis: 10000,
};

export const createTopic = async (
  admin: Admin,
  topic: string,
  numPartitions: number
): Promise<void> => {
  await admin.createTopics({
    topics: [{ topic, numPartitions, replicationFactor: 1 }],
    waitForLeaders: true,
  });
};

export const produceMessages = async (
  topic: string,
  values: string[]
): Promise<void> => {
  const producer = testKafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();
  try {
    await producer.send({
      topic,
      messages: values.map((value) => ({ key: value, value })),
    });
  } finally {
    await producer.disconnect();
  }
};

export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  description: string,
  timeoutMillis: number = 60000,
  intervalMillis: number = 200
): Promise<void> => {
  const deadline = Date.now() + timeoutMillis;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMillis));
  }
  throw new Error(`Timeout while waiting for: ${description}`);
};

// True when the committed group offset of every partition equals the
// high watermark of that partition.
export const allOffsetsCommitted = async (
  admin: Admin,
  groupId: string,
  topic: string
): Promise<boolean> => {
  const watermarks = await admin.fetchTopicOffsets(topic);
  const [committed] = await admin.fetchOffsets({ groupId, topics: [topic] });
  return watermarks.every((w) => {
    const partitionOffset =
      committed.partitions.find((p) => p.partition === w.partition)?.offset ??
      "-1";
    // A partition without messages never receives a commit.
    // Its committed offset stays -1 and that is complete as well.
    return (
      partitionOffset === w.offset ||
      (w.offset === "0" && partitionOffset === "-1")
    );
  });
};
