import { describe, beforeAll, vi, afterEach, it, expect } from "vitest";
import {
  logger,
  EmailManagerSES,
  HtmlTemplateService,
} from "pagopa-interop-commons";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import { TenantReadModelService } from "pagopa-interop-readmodel";
import { generateId, UserId, TenantId } from "pagopa-interop-models";
import { emailSenderProcessorBuilder } from "../src/services/emailSenderProcessor.js";

describe("getUserFromSelfcare", () => {
  // eslint-disable-next-line functional/no-let
  let emailSenderProcessor: ReturnType<typeof emailSenderProcessorBuilder>;
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

  const userId: UserId = generateId<UserId>();
  const tenantId: TenantId = generateId<TenantId>();
  const loggerInstance = logger({ serviceName: "email-sender-test" });

  beforeAll(async () => {
    const mockSESEmailManager = {
      kind: "SES",
      send: vi.fn().mockResolvedValue(undefined),
    } as EmailManagerSES;

    const mockTemplateService = {
      compileHtml: vi.fn((body: string) => body),
    } as unknown as HtmlTemplateService;

    emailSenderProcessor = emailSenderProcessorBuilder(
      { label: "mock sender", mail: "sender@mock.com" },
      mockSESEmailManager,
      mockSelfcareV2InstitutionClient,
      mockTenantReadModelService,
      mockTemplateService
    );
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  const expectGetUserFromSelfcareToThrow = async (
    expectedError: string
  ): Promise<void> => {
    await expect(() =>
      emailSenderProcessor.getUserFromSelfcare(userId, tenantId, loggerInstance)
    ).rejects.toThrowError(expectedError);
  };

  it("should throw error when tenant is not found in readmodel", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockTenantReadModelService.getTenantById = vi
      .fn()
      .mockResolvedValueOnce(null);

    await expectGetUserFromSelfcareToThrow(
      `Tenant ${tenantId} not found in readmodel for user ${userId}`
    );
  });

  it("should throw error when tenant has no selfcareId", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockTenantReadModelService.getTenantById = vi.fn().mockResolvedValueOnce({
      data: {
        selfcareId: undefined,
        email: "tenant@mock.com",
      },
    });

    await expectGetUserFromSelfcareToThrow(
      `Tenant ${tenantId} has no selfcareId in readmodel for user ${userId}`
    );
  });

  it("should return undefined when no users found in Selfcare", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockTenantReadModelService.getTenantById = vi.fn().mockResolvedValueOnce({
      data: {
        selfcareId: "mock-selfcare-id-1",
      },
    });
    // eslint-disable-next-line functional/immutable-data
    mockSelfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET = vi
      .fn()
      .mockResolvedValueOnce([]);

    const result = await emailSenderProcessor.getUserFromSelfcare(
      userId,
      tenantId,
      loggerInstance
    );

    expect(result).toBeUndefined();
  });

  it("should return undefined when multiple users found in Selfcare", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockTenantReadModelService.getTenantById = vi.fn().mockResolvedValueOnce({
      data: {
        selfcareId: "mock-selfcare-id-2",
      },
    });
    // eslint-disable-next-line functional/immutable-data
    mockSelfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET = vi
      .fn()
      .mockResolvedValueOnce([
        { email: "user1@mock.com" },
        { email: "user2@mock.com" },
      ]);

    const result = await emailSenderProcessor.getUserFromSelfcare(
      userId,
      tenantId,
      loggerInstance
    );

    expect(result).toBeUndefined();
  });

  it("should return undefined when user has no email in Selfcare", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockTenantReadModelService.getTenantById = vi.fn().mockResolvedValueOnce({
      data: {
        selfcareId: "mock-selfcare-id-3",
      },
    });
    // eslint-disable-next-line functional/immutable-data
    mockSelfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET = vi
      .fn()
      .mockResolvedValueOnce([{ email: undefined }]);

    const result = await emailSenderProcessor.getUserFromSelfcare(
      userId,
      tenantId,
      loggerInstance
    );

    expect(result).toBeUndefined();
  });

  it("should return undefined when user not found in Selfcare (404)", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockTenantReadModelService.getTenantById = vi.fn().mockResolvedValueOnce({
      data: {
        selfcareId: "mock-selfcare-id-4",
      },
    });
    // eslint-disable-next-line functional/immutable-data
    mockSelfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET = vi
      .fn()
      .mockRejectedValueOnce({ status: 404 });

    const result = await emailSenderProcessor.getUserFromSelfcare(
      userId,
      tenantId,
      loggerInstance
    );

    expect(result).toBeUndefined();
  });

  it("should throw error after max retries on Selfcare API failures", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockTenantReadModelService.getTenantById = vi.fn().mockResolvedValue({
      data: {
        selfcareId: "mock-selfcare-id-5",
      },
    });
    // eslint-disable-next-line functional/immutable-data
    mockSelfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET = vi
      .fn()
      .mockRejectedValue(new Error("API Error"));

    await expectGetUserFromSelfcareToThrow(
      `Failed to fetch user ${userId} of tenant ${tenantId} from Selfcare`
    );
  });

  it("should return email when user found successfully", async () => {
    const expectedEmail = "user@mock.com";
    // eslint-disable-next-line functional/immutable-data
    mockTenantReadModelService.getTenantById = vi.fn().mockResolvedValueOnce({
      data: {
        selfcareId: "mock-selfcare-id-6",
      },
    });
    // eslint-disable-next-line functional/immutable-data
    mockSelfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET = vi
      .fn()
      .mockResolvedValueOnce([
        { email: expectedEmail, name: "Jhon", surname: "Doe" },
      ]);

    const result = await emailSenderProcessor.getUserFromSelfcare(
      userId,
      tenantId,
      loggerInstance
    );

    expect(result).toEqual({
      email: expectedEmail,
      name: "Jhon Doe",
    });
  });
});
