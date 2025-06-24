import { describe, expect, it, vi, afterAll, beforeEach } from "vitest";
import { InternalError } from "pagopa-interop-models";
import { CommonErrorCodes, decodeSQSMessageError } from "pagopa-interop-models";
import { QueueMessage } from "pagopa-interop-commons";
import { Message } from "@aws-sdk/client-sqs";
import { handleMessage } from "../src/handlers/handleMessage.js";
import { ApplicationAuditEventMessageSchema } from "../src/models/queue.js";
import { KafkaProducer } from "../src/models/kafka.js";
import { getMockBeginRequestAudit } from "./utils.js";

describe("Process message test", () => {
  const sendMock = vi.fn();

  const mockProducer = {
    send: sendMock,
  } as unknown as KafkaProducer;

  const processMessage = handleMessage(mockProducer);

  beforeEach(() => {
    sendMock.mockReset();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("given valid message, method should call kafka producer send", async () => {
    const mockBeginRequestAudit: QueueMessage = {
      correlationId: getMockBeginRequestAudit.correlationId,
      spanId: getMockBeginRequestAudit.spanId,
      payload: getMockBeginRequestAudit,
    };
    const validMessage: Message = {
      MessageId: "12345",
      ReceiptHandle: "receipt_handle_id",
      Body: JSON.stringify(mockBeginRequestAudit),
    };

    await expect(processMessage(validMessage)).resolves.not.toThrowError();

    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("given invalid message, should throw an error", async () => {
    const invalidMessage = {};

    try {
      await processMessage(invalidMessage);
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError<CommonErrorCodes>).code).toBe(
        "decodeSQSMessageError"
      );
    }
  });

  it("given invalid Body message, should throw an error", async () => {
    const missingBodyMessage: Message = {
      MessageId: "12345",
      ReceiptHandle: "receipt_handle_id",
      Body: undefined,
    };

    const parsed = ApplicationAuditEventMessageSchema.safeParse({
      value: missingBodyMessage.Body,
    });

    await expect(processMessage(missingBodyMessage)).rejects.toThrowError(
      decodeSQSMessageError(missingBodyMessage.MessageId, parsed.error)
    );
  });
});
