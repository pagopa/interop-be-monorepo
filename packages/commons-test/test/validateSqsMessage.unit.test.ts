import { Message } from "@aws-sdk/client-sqs";
import { Logger } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";

import { validateSqsMessage } from "../../commons/src/sqs/queueManagerMessageValidation.js";

const logger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  isDebugEnabled: vi.fn(),
};

describe("validateSqsMessage", () => {
  it("should skip an SQS message whose body is not valid JSON", () => {
    const message: Message = {
      MessageId: "message-id",
      Body: "not-valid-json",
    };

    expect(validateSqsMessage(message, logger)).toBe("SkipEvent");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/message-id.*not-valid-json/)
    );
  });
});
