/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { describe, expect, it } from "vitest";
import {
  genericLogger,
  queueManagerSendError,
  queueManagerReceiveError,
  QueueMessage,
} from "pagopa-interop-commons";
import {
  nonExistingQueueUrl,
  nonExistingQueueWriter,
  queueWriter,
  producerQueueUrl,
  getMockBeginRequestAudit,
} from "./utils.js";

describe("Queue Manager tests", async () => {
  describe("QueueWriter", () => {
    it("should send a message to the queue and receive it back", async () => {
      const mockBeginRequestAudit: QueueMessage = {
        correlationId: getMockBeginRequestAudit.correlationId,
        spanId: getMockBeginRequestAudit.spanId,
        payload: getMockBeginRequestAudit,
      };

      await queueWriter.send(
        producerQueueUrl,
        {
          correlationId: getMockBeginRequestAudit.correlationId,
          spanId: getMockBeginRequestAudit.spanId,
          payload: getMockBeginRequestAudit,
        },
        genericLogger
      );

      const lastMessage = (
        await queueWriter.receiveLast(producerQueueUrl, genericLogger)
      )[0];
      expect(lastMessage).toMatchObject(mockBeginRequestAudit);
    });

    it("should fail to send a message to a non existing queue", async () => {
      const mockBeginRequestAudit: QueueMessage = {
        correlationId: getMockBeginRequestAudit.correlationId,
        spanId: getMockBeginRequestAudit.spanId,
        payload: getMockBeginRequestAudit,
      };

      await expect(
        nonExistingQueueWriter.send(
          nonExistingQueueUrl,
          mockBeginRequestAudit,
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
        nonExistingQueueWriter.receiveLast(nonExistingQueueUrl, genericLogger)
      ).rejects.toThrowError(
        queueManagerReceiveError(
          nonExistingQueueUrl,
          new Error("The specified queue does not exist.")
        )
      );
    });
  });
});
