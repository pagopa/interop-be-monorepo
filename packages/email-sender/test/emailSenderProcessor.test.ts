import { describe, beforeAll, vi, afterEach, it, expect } from "vitest";
import { EmailManagerSES, Logger } from "pagopa-interop-commons";
import { EachMessagePayload } from "kafkajs";
import { emailSenderProcessorBuilder } from "../src/services/emailSenderProcessor.js";
import { kafkaMessagePayload } from "./utils.js";

describe("emailSenderProcessor", () => {
  // eslint-disable-next-line functional/no-let
  let emailSenderProcessor: ReturnType<typeof emailSenderProcessorBuilder>;
  const mockLoggerInstance = {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  } as unknown as Logger;
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
      mockLoggerInstance,
      mockSESEmailManager,
      mockSESSender
    );
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("should send email when message has subject, address and body", async () => {
    const message: EachMessagePayload = kafkaMessagePayload;
    await emailSenderProcessor.processMessage(message);
    // Not sure what to check yet
    expect(mockSESEmailManager.send).toHaveBeenCalledOnce();
  });

  // it.each([])("should throw error if message is malformed", async () => {
  //   // check subject, address and body
  // });
  // it("should skip empty message", async () => { });

  // it("should retry to send the email when hitting the limit of aws ses", async () => { });

  // it("should throw error when attempting a number of times over the max allowed attempts", async () => { });
});
