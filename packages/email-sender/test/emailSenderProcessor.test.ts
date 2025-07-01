import { describe, beforeAll, vi, afterEach, it, expect } from "vitest";
import { EmailManagerSES } from "pagopa-interop-commons";
import { TooManyRequestsException } from "@aws-sdk/client-sesv2";
import { emailSenderProcessorBuilder } from "../src/services/emailSenderProcessor.js";
import {
  correctEventPayload,
  kafkaMessagePayload,
  kafkaMessagePayloadWithValue,
} from "./utils.js";

describe("emailSenderProcessor", () => {
  // eslint-disable-next-line functional/no-let
  let emailSenderProcessor: ReturnType<typeof emailSenderProcessorBuilder>;
  const mockSESEmailManager = {
    kind: "SES",
    send: vi.fn().mockResolvedValue(undefined),
  } as EmailManagerSES;
  const mockSESSender = {
    label: "mock sender",
    mail: "sender@mock.com",
  };

  beforeAll(async () => {
    emailSenderProcessor = emailSenderProcessorBuilder(
      mockSESSender,
      mockSESEmailManager
    );
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("should send email when message has subject, address and body", async () => {
    const message = kafkaMessagePayload;
    await emailSenderProcessor.processMessage(message);
    expect(mockSESEmailManager.send).toHaveBeenCalledOnce();
  });

  it.each([
    {
      eventPayload: { ...correctEventPayload, subject: undefined },
    },
    {
      eventPayload: { ...correctEventPayload, address: undefined },
    },
    {
      eventPayload: { ...correctEventPayload, body: undefined },
    },
    {
      eventPayload: { ...correctEventPayload, correlationId: undefined },
    },
    {
      eventPayload: { ...correctEventPayload, address: "invalid" },
    },
    {
      eventPayload: { ...correctEventPayload, correlationId: "invalid" },
    },
  ])(
    "should throw error if message is malformed: %s",
    async ({ eventPayload }) => {
      const message = kafkaMessagePayloadWithValue({ eventPayload });
      await expect(() =>
        emailSenderProcessor.processMessage(message)
      ).rejects.toThrowError();
      expect(mockSESEmailManager.send).toBeCalledTimes(0);
    }
  );

  it("should skip empty message", async () => {
    const message = kafkaMessagePayloadWithValue(null);
    await emailSenderProcessor.processMessage(message);
    expect(mockSESEmailManager.send).toHaveBeenCalledTimes(0);
  });

  it("should throw error when hitting the rate limit of aws ses", async () => {
    const message = kafkaMessagePayload;
    // eslint-disable-next-line functional/immutable-data
    mockSESEmailManager.send = vi.fn().mockRejectedValue(
      new TooManyRequestsException({
        message: "message",
        $metadata: {},
      })
    );
    await expect(() =>
      emailSenderProcessor.processMessage(message)
    ).rejects.toThrowError();
  });
});
