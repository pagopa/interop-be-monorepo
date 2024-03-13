/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QueueManager, initQueueManager } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { StartedTestContainer } from "testcontainers";
import {
  TEST_ELASTIC_MQ_PORT,
  elasticMQContainer,
} from "../src/containerTestUtils.js";

describe("FileManager tests", async () => {
  process.env.AWS_CONFIG_FILE = "aws.config.local";

  let queueWriter: QueueManager;
  let startedElasticMQContainer: StartedTestContainer;

  const testQueueUrl = (port: number): string =>
    `http://localhost:${startedElasticMQContainer.getMappedPort(
      port
    )}/000000000000/sqsLocalQueue.fifo`;

  beforeAll(async () => {
    startedElasticMQContainer = await elasticMQContainer().start();

    queueWriter = initQueueManager({
      queueUrl: testQueueUrl(TEST_ELASTIC_MQ_PORT),
      logLevel: "debug",
    });
  });

  afterAll(async () => {
    await startedElasticMQContainer.stop();
  });

  describe("QueueWriter send", () => {
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
  });
});
