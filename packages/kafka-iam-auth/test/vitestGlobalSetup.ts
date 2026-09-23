import { createServer } from "net";
import { GenericContainer, Wait } from "testcontainers";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    kafkaBrokers: string[];
  }
}

const TEST_KAFKA_IMAGE = "apache/kafka:3.7.0";
const KAFKA_CLIENT_PORT = 9092;

// The advertised listener must contain the host port, and the broker needs
// it before the container starts. A dynamic testcontainers port is known
// only after the start, so the setup reserves a free host port first.
const getFreeHostPort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Free port lookup failed"));
        return;
      }
      const port = address.port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });

export default async function setup(
  project: TestProject
): Promise<() => Promise<void>> {
  const hostPort = await getFreeHostPort();

  const kafkaContainer = await new GenericContainer(TEST_KAFKA_IMAGE)
    .withEnvironment({
      CLUSTER_ID: "test-kafka-iam-auth-cluster",
      KAFKA_NODE_ID: "1",
      KAFKA_PROCESS_ROLES: "broker,controller",
      KAFKA_CONTROLLER_QUORUM_VOTERS: "1@localhost:9093",
      KAFKA_LISTENERS: `PLAINTEXT://0.0.0.0:${KAFKA_CLIENT_PORT},BROKER://0.0.0.0:29092,CONTROLLER://0.0.0.0:9093`,
      KAFKA_ADVERTISED_LISTENERS: `PLAINTEXT://localhost:${hostPort},BROKER://localhost:29092`,
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP:
        "PLAINTEXT:PLAINTEXT,BROKER:PLAINTEXT,CONTROLLER:PLAINTEXT",
      KAFKA_INTER_BROKER_LISTENER_NAME: "BROKER",
      KAFKA_CONTROLLER_LISTENER_NAMES: "CONTROLLER",
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1",
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1",
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: "1",
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: "0",
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false",
    })
    .withExposedPorts({ container: KAFKA_CLIENT_PORT, host: hostPort })
    .withWaitStrategy(Wait.forLogMessage(/Kafka Server started/))
    .start();

  project.provide("kafkaBrokers", [`localhost:${hostPort}`]);

  return async (): Promise<void> => {
    await kafkaContainer.stop();
  };
}
