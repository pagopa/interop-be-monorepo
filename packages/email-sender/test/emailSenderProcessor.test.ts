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
import {
  EmailManagerSES,
  genericLogger,
  HtmlTemplateService,
} from "pagopa-interop-commons";
import { ContactId, generateId } from "pagopa-interop-models";
import { TenantReadModelService } from "pagopa-interop-readmodel";
import { describe, beforeAll, vi, afterEach, it, expect } from "vitest";

import { emailSenderProcessorBuilder } from "../src/services/emailSenderProcessor.js";
import { getTenantContactEmail } from "../src/services/recipientLookup.js";
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
        name: "John",
        surname: "Doe",
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
  const mockTemplateService = {
    compileHtml: vi.fn((body: string) => body),
  } as unknown as HtmlTemplateService;

  const readContactEmail = vi.fn();
  const contactId = generateId<ContactId>();
  const contactPayload = {
    type: "Tenant",
    tenantId: correctTenantEventPayload.tenantId,
    correlationId: correctTenantEventPayload.correlationId,
    email: correctTenantEventPayload.email,
    contactId,
  };
  const contactMessage = kafkaMessagePayloadWithValueTenant(contactPayload);

  beforeAll(async () => {
    emailSenderProcessor = emailSenderProcessorBuilder(
      mockSESSender,
      mockSESEmailManager,
      mockSelfcareV2InstitutionClient,
      mockTenantReadModelService,
      mockTemplateService,
      readContactEmail
    );
  });

  afterEach(async () => {
    vi.clearAllMocks();
    readContactEmail.mockReset();
  });

  it("should send email when message has subject, address and body for tenant", async () => {
    const message = kafkaMessagePayloadTenant;
    await emailSenderProcessor.processMessage(message);
    expect(readContactEmail).not.toHaveBeenCalled();
    expect(mockSESEmailManager.send).toHaveBeenCalledOnce();
  });

  it("resolves the queued contact without reading the current tenant", async () => {
    const email = "queued@example.com";
    readContactEmail.mockResolvedValue(email);
    await emailSenderProcessor.processMessage(contactMessage);
    expect(readContactEmail).toHaveBeenCalledWith(contactId);
    expect(mockTenantReadModelService.getTenantById).not.toHaveBeenCalled();
    expect(mockSESEmailManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: [email] }),
      expect.anything()
    );
  });

  it("skips an absent contact without retry or delivery", async () => {
    readContactEmail.mockResolvedValue(undefined);
    await emailSenderProcessor.processMessage(contactMessage);
    expect(readContactEmail).toHaveBeenCalledTimes(1);
    expect(mockSESEmailManager.send).not.toHaveBeenCalled();
  });

  it.each([new Error("connection reset"), new Error("query timeout")])(
    "retries a temporary database failure and delivers once",
    async (error) => {
      readContactEmail
        .mockRejectedValueOnce(error)
        .mockResolvedValue("queued@example.com");
      await emailSenderProcessor.processMessage(contactMessage);
      expect(readContactEmail).toHaveBeenCalledTimes(2);
      expect(mockSESEmailManager.send).toHaveBeenCalledOnce();
    }
  );

  it("rejects the message when database attempts are exhausted", async () => {
    readContactEmail.mockRejectedValue(new Error("queued@example.com"));
    await expect(
      emailSenderProcessor.processMessage(contactMessage)
    ).rejects.toThrow(
      new RegExp(`^Failed to fetch contact ${contactId} after [0-9]+ attempts$`)
    );
    expect(mockSESEmailManager.send).not.toHaveBeenCalled();
  });

  it("logs retry and skip reasons without exposing a database response or an address", async () => {
    const email = "private-contact@example.com";
    const logger = {
      ...genericLogger,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    readContactEmail
      .mockRejectedValueOnce(new Error(email))
      .mockResolvedValue(undefined);
    const resolved = await getTenantContactEmail(
      contactId,
      readContactEmail,
      logger
    );
    expect(resolved).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("not found")
    );
    expect(
      JSON.stringify([
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ])
    ).not.toContain(email);
  });

  it("rejects ambiguous recipients instead of using the legacy address", async () => {
    await emailSenderProcessor.processMessage(
      kafkaMessagePayloadWithValueTenant({
        ...contactPayload,
        address: "stale@example.com",
      })
    );
    expect(readContactEmail).not.toHaveBeenCalled();
    expect(mockSESEmailManager.send).not.toHaveBeenCalled();
  });

  it("should send email when message has subject, address and body for user", async () => {
    const message = kafkaMessagePayloadUser;
    await emailSenderProcessor.processMessage(message);
    expect(readContactEmail).not.toHaveBeenCalled();
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
