/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// import { StartedTestContainer } from "testcontainers";
import { QueueManager, initQueueManager } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { GenericContainer, StartedTestContainer } from "testcontainers";

describe("FileManager tests", async () => {
  process.env.AWS_CONFIG_FILE = "aws.config.local";

  let queueWriter: QueueManager;
  let startedElasticMQContainer: StartedTestContainer;

  beforeAll(async () => {
    startedElasticMQContainer = await new GenericContainer(
      "softwaremill/elasticmq-native:latest"
    )
      .withExposedPorts(9324)
      .withCopyFilesToContainer([
        {
          source: "elasticmq.custom.conf",
          target: "/opt/elasticmq.conf",
        },
      ])
      .start();

    queueWriter = initQueueManager({
      queueUrl: `http://localhost:${startedElasticMQContainer.getMappedPort(
        9324
      )}/000000000000/testQueue.fifo`,
      logLevel: "debug",
    });
  });

  afterAll(async () => {
    await startedElasticMQContainer.stop();
  });

  describe("QueueWriter send", () => {
    it("should send a message to the queue", async () => {
      await queueWriter.send({
        messageUUID: uuidv4(),
        kind: "TestEvent",
        eventJournalPersistenceId: "test",
        eventJournalSequenceNumber: 1,
        eventTimestamp: new Date().getTime(),
        payload: {
          test: "test",
          foo: "bar",
        },
      });

      const lastMessage = (await queueWriter.receiveLast())[0];
      expect(lastMessage).toMatchObject({
        kind: "TestEvent",
        eventJournalPersistenceId: "test",
        eventJournalSequenceNumber: 1,
        payload: {
          test: "test",
          foo: "bar",
        },
      });
    });
  });
});
