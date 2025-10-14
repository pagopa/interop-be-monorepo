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
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import { TenantReadModelService } from "pagopa-interop-readmodel";
import { emailSenderProcessorBuilder } from "../src/services/emailSenderProcessor.js";
import {
  correctTenantEventPayload,
  kafkaMessagePayloadTenant,
  kafkaMessagePayloadUser,
  kafkaMessagePayloadWithValueTenant,
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
  const mockSelfcareV2InstitutionClient = {
    getInstitutionUsersByProductUsingGET: vi.fn().mockResolvedValue([
      {
        email: "user@mock.com",
      },
    ]),
  } as unknown as SelfcareV2InstitutionClient;
  const mockTenantReadModelService = {
    getTenantById: vi.fn().mockResolvedValue({
      data: {
        selfcareId: "mock-selfcare-id",
        email: "tenant@mock.com",
      },
    }),
  } as unknown as TenantReadModelService;

  beforeAll(async () => {
    emailSenderProcessor = emailSenderProcessorBuilder(
      mockSESSender,
      mockSESEmailManager,
      mockSelfcareV2InstitutionClient,
      mockTenantReadModelService
    );
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("should send email when message has subject, address and body for tenant", async () => {
    const message = kafkaMessagePayloadTenant;
    await emailSenderProcessor.processMessage(message);
    expect(mockSESEmailManager.send).toHaveBeenCalledOnce();
  });

  it("should send email when message has subject, address and body for user", async () => {
    const message = kafkaMessagePayloadUser;
    await emailSenderProcessor.processMessage(message);
    expect(mockSESEmailManager.send).toHaveBeenCalledOnce();
  });

  it.each([
    {
      eventPayload: null,
    },
    {
      eventPayload: {
        ...correctTenantEventPayload,
        email: { ...correctTenantEventPayload.email, subject: undefined },
      },
    },
    {
      eventPayload: {
        ...correctTenantEventPayload,
        email: { ...correctTenantEventPayload.email, body: undefined },
      },
    },
    {
      eventPayload: { ...correctTenantEventPayload, address: undefined },
    },
    {
      eventPayload: { ...correctTenantEventPayload, correlationId: undefined },
    },
    {
      eventPayload: { ...correctTenantEventPayload, correlationId: undefined },
    },
    {
      eventPayload: { ...correctTenantEventPayload, address: "invalid" },
    },
    {
      eventPayload: { ...correctTenantEventPayload, correlationId: "invalid" },
    },
    {
      eventPayload: {
        ...correctTenantEventPayload,
        email: { ...correctTenantEventPayload.email, subject: "" },
      },
    },
    {
      eventPayload: {
        ...correctTenantEventPayload,
        email: { ...correctTenantEventPayload.email, body: "" },
      },
    },
  ])("should skip if message is malformed: %s", async ({ eventPayload }) => {
    const message = kafkaMessagePayloadWithValueTenant({ eventPayload });
    await emailSenderProcessor.processMessage(message);
    expect(mockSESEmailManager.send).toHaveBeenCalledTimes(0);
  });

  it("should attempt to send the email again when api throttles", async () => {
    const message = kafkaMessagePayloadTenant;
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
      const message = kafkaMessagePayloadTenant;
      // eslint-disable-next-line functional/immutable-data
      mockSESEmailManager.send = vi.fn().mockRejectedValueOnce(error);
      await expect(() =>
        emailSenderProcessor.processMessage(message)
      ).rejects.toThrowError();
      expect(mockSESEmailManager.send).toBeCalledTimes(1);
    }
  );
});
