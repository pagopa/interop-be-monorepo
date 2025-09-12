import { describe, it, expect, vi } from "vitest";
import { genericInternalError } from "pagopa-interop-models";
import type { Message } from "@aws-sdk/client-sqs";
import { decodeSQSEventMessage } from "../../../src/utils/decodeSQSEventMessage.js";

vi.mock("pagopa-interop-models", () => ({
  genericInternalError: vi.fn((msg: string) => new Error(msg)),
}));

describe("decodeSQSEventMessage", () => {
  const mockGenericInternalError =
    genericInternalError as unknown as ReturnType<typeof vi.fn>;

  it("should decode a valid SQS message and return the S3 object key", () => {
    const message: Message = {
      MessageId: "123",
      Body: JSON.stringify({
        Records: [
          {
            s3: {
              object: {
                key: "my-file.txt",
              },
            },
          },
        ],
      }),
    };

    const result = decodeSQSEventMessage(message);
    expect(result).toBe("my-file.txt");
  });

  it("should throw genericInternalError when Body is missing", () => {
    const message: Message = {
      MessageId: "456",
      Body: undefined,
    };

    expect(() => decodeSQSEventMessage(message)).toThrow();
    expect(mockGenericInternalError).toHaveBeenCalledWith(
      expect.stringContaining("Message body is undefined")
    );
  });

  it("should throw genericInternalError when Records array is empty", () => {
    const message: Message = {
      MessageId: "789",
      Body: JSON.stringify({ Records: [] }),
    };

    expect(() => decodeSQSEventMessage(message)).toThrow();
    expect(mockGenericInternalError).toHaveBeenCalledWith(
      expect.stringContaining("S3Body doesn't contain records")
    );
  });

  it("should throw genericInternalError when Body contains invalid JSON", () => {
    const message: Message = {
      MessageId: "999",
      Body: "{ invalid json",
    };

    expect(() => decodeSQSEventMessage(message)).toThrow();
    expect(mockGenericInternalError).toHaveBeenCalledWith(
      expect.stringContaining("MessageId: 999")
    );
    expect(mockGenericInternalError).toHaveBeenCalledWith(
      expect.stringContaining("SyntaxError")
    );
  });
});
