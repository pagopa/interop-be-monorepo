/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { v4 as uuidv4 } from "uuid";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  queueManagerReceiveError,
  queueManagerSendError,
} from "../src/queue-manager/queueManagerErrors.js";
import {
  nonExistingQueueUrl,
  nonExistingQueueWriter,
  queueWriter,
} from "./utils.js";

describe("FileManager tests", async () => {
  describe("QueueWriter", () => {
    it("should send a message to the queue and receive it back", async () => {
      await queueWriter.send(
        {
          messageUUID: uuidv4(),
          kind: "TestMessageKind",
          eventJournalPersistenceId: "test-persistence-id",
          eventJournalSequenceNumber: 0,
          eventTimestamp: new Date().getTime(),
          payload: {
            test: "test",
            foo: "bar",
          },
        },
        genericLogger
      );

      const lastMessage = (await queueWriter.receiveLast(genericLogger))[0];
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
        nonExistingQueueWriter.send(
          {
            messageUUID: uuidv4(),
            kind: "TestMessageKind",
            eventJournalPersistenceId: "test-persistence-id",
            eventJournalSequenceNumber: 0,
            eventTimestamp: new Date().getTime(),
            payload: {
              test: "test",
              foo: "bar",
            },
          },
          genericLogger
        )
      ).rejects.toThrowError(
        queueManagerSendError(
          nonExistingQueueUrl,
          new Error("The specified queue does not exist.")
        )
      );
    });

    it("should fail to receive a message from a non existing queue", async () => {
      await expect(
        nonExistingQueueWriter.receiveLast(genericLogger)
      ).rejects.toThrowError(
        queueManagerReceiveError(
          nonExistingQueueUrl,
          new Error("The specified queue does not exist.")
        )
      );
    });
  });
});
