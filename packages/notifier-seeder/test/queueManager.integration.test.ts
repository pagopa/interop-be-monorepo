/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { StartedTestContainer, GenericContainer } from "testcontainers";
import { v4 as uuidv4 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  QueueManager,
  initQueueManager,
} from "../src/queue-manager/queueManager.js";
import {
  queueManagerReceiveError,
  queueManagerSendError,
} from "../src/queue-manager/queueManagerErrors.js";

export const TEST_ELASTIC_MQ_IMAGE = "softwaremill/elasticmq-native:latest";
export const TEST_ELASTIC_MQ_PORT = 9324;

export const elasticMQContainer = (): GenericContainer =>
  new GenericContainer(TEST_ELASTIC_MQ_IMAGE)
    .withCopyFilesToContainer([
      {
        source: "elasticmq.local.conf",
        target: "/opt/elasticmq.conf",
      },
    ])
    .withExposedPorts(TEST_ELASTIC_MQ_PORT);

describe("FileManager tests", async () => {
  process.env.AWS_CONFIG_FILE = "aws.config.local";

  let startedElasticMQContainer: StartedTestContainer;
  let queueUrl: string;
  let queueWriter: QueueManager;
  let nonExistingQueueUrl: string;
  let nonExistingQueueWriter: QueueManager;

  beforeAll(async () => {
    startedElasticMQContainer = await elasticMQContainer().start();

    queueUrl = `http://localhost:${startedElasticMQContainer.getMappedPort(
      TEST_ELASTIC_MQ_PORT
    )}/000000000000/sqsLocalQueue.fifo`;

    queueWriter = initQueueManager({
      queueUrl,
      messageGroupId: "test-message-group-id",
      logLevel: "info",
    });

    nonExistingQueueUrl = `http://localhost:${startedElasticMQContainer.getMappedPort(
      TEST_ELASTIC_MQ_PORT
    )}/000000000000/nonExistingQueue`;

    nonExistingQueueWriter = initQueueManager({
      queueUrl: nonExistingQueueUrl,
      messageGroupId: "test-message-group-id",
      logLevel: "info",
    });
  });

  afterAll(async () => {
    await startedElasticMQContainer.stop();
  });

  describe("QueueWriter", () => {
    it("should send a message to the queue and receive it back", async () => {
      await queueWriter.send({
        messageUUID: uuidv4(),
        kind: "TestMessageKind",
        eventJournalPersistenceId: "test-persistence-id",
        eventJournalSequenceNumber: 0,
        eventTimestamp: new Date().getTime(),
        payload: {
          test: "test",
          foo: "bar",
        },
      });

      const lastMessage = (await queueWriter.receiveLast())[0];
      expect(lastMessage).toMatchObject({
        kind: "TestMessageKind",
        eventJournalPersistenceId: "test-persistence-id",
        eventJournalSequenceNumber: 0,
        payload: {
          test: "test",
          foo: "bar",
        },
      });
    });

    it("should fail to send a message to a non existing queue", async () => {
      await expect(
        nonExistingQueueWriter.send({
          messageUUID: uuidv4(),
          kind: "TestMessageKind",
          eventJournalPersistenceId: "test-persistence-id",
          eventJournalSequenceNumber: 0,
          eventTimestamp: new Date().getTime(),
          payload: {
            test: "test",
            foo: "bar",
          },
        })
      ).rejects.toThrowError(
        queueManagerSendError(
          nonExistingQueueUrl,
          new Error("The specified queue does not exist.")
        )
      );
    });

    it("should fail to receive a message from a non existing queue", async () => {
      await expect(nonExistingQueueWriter.receiveLast()).rejects.toThrowError(
        queueManagerReceiveError(
          nonExistingQueueUrl,
          new Error("The specified queue does not exist.")
        )
      );
    });
  });
});
