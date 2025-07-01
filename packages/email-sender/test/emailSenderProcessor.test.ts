import { describe, beforeAll, vi, afterEach, it, expect } from "vitest";
import { EmailManagerSES } from "pagopa-interop-commons";
import {
  AccountSuspendedException,
  BadRequestException,
  LimitExceededException,
  MailFromDomainNotVerifiedException,
  MessageRejected,
  NotFoundException,
  SendingPausedException,
  TooManyRequestsException,
} from "@aws-sdk/client-sesv2";
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
      eventPayload: null,
    },
    {
      eventPayload: {
        ...correctEventPayload,
        email: { ...correctEventPayload.email, subject: undefined },
      },
    },
    {
      eventPayload: {
        ...correctEventPayload,
        email: { ...correctEventPayload.email, body: undefined },
      },
    },
    {
      eventPayload: { ...correctEventPayload, address: undefined },
    },
    {
      eventPayload: { ...correctEventPayload, correlationId: undefined },
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
    {
      eventPayload: {
        ...correctEventPayload,
        email: { ...correctEventPayload.email, subject: "" },
      },
    },
    {
      eventPayload: {
        ...correctEventPayload,
        email: { ...correctEventPayload.email, body: "" },
      },
    },
  ])("should skip if message is malformed: %s", async ({ eventPayload }) => {
    const message = kafkaMessagePayloadWithValue({ eventPayload });
    await emailSenderProcessor.processMessage(message);
    expect(mockSESEmailManager.send).toHaveBeenCalledTimes(0);
  });

  it("should attempt to send the email again when api throttles", async () => {
    const message = kafkaMessagePayload;
    // eslint-disable-next-line functional/immutable-data
    mockSESEmailManager.send = vi.fn().mockRejectedValueOnce(
      new TooManyRequestsException({
        message: "message",
        $metadata: {},
      })
    );
    await emailSenderProcessor.processMessage(message);
    expect(mockSESEmailManager.send).toHaveBeenCalledTimes(2);
  });

  it.each([
    { error: new AccountSuspendedException({ message: "", $metadata: {} }) },
    { error: new BadRequestException({ message: "", $metadata: {} }) },
    {
      error: new MailFromDomainNotVerifiedException({
        message: "",
        $metadata: {},
      }),
    },
    { error: new MessageRejected({ message: "", $metadata: {} }) },
    { error: new NotFoundException({ message: "", $metadata: {} }) },
    { error: new LimitExceededException({ message: "", $metadata: {} }) },
    { error: new SendingPausedException({ message: "", $metadata: {} }) },
  ])(
    "should throw error when the send fails because of error %s",
    async ({ error }) => {
      const message = kafkaMessagePayload;
      // eslint-disable-next-line functional/immutable-data
      mockSESEmailManager.send = vi.fn().mockRejectedValueOnce(error);
      await expect(() =>
        emailSenderProcessor.processMessage(message)
      ).rejects.toThrowError();
      expect(mockSESEmailManager.send).toBeCalledTimes(1);
    }
  );
});
