/* eslint-disable prefer-const */
/* eslint-disable functional/no-let */
import { vi, afterEach, beforeAll, beforeEach, describe } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  getInteropHeaders,
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { selfcareOnboardingProcessorBuilder } from "../src/services/selfcareOnboardingProcessor.js";
import { TenantProcessClient } from "../src/clients/tenantProcessClient.js";
import { config } from "../src/config/config.js";
import { allowedOrigins, interopProductName } from "./utils.js";

describe("Message processor", () => {
  const testCorrelationId = generateId();
  const testToken = "mockToken";
  const testHeaders = getInteropHeaders({
    correlationId: testCorrelationId,
    token: testToken,
  });

  let mockTenantProcessClient: TenantProcessClient;
  let tokenGeneratorMock = new InteropTokenGenerator(config);
  let refreshableTokenMock = new RefreshableInteropToken(tokenGeneratorMock);
  let selfcareOnboardingProcessor: ReturnType<
    typeof selfcareOnboardingProcessorBuilder
  >;

  beforeAll(async () => {
    selfcareOnboardingProcessor = selfcareOnboardingProcessorBuilder(
      refreshableTokenMock,
      mockTenantProcessClient,
      interopProductName,
      allowedOrigins
    );
  });

  beforeEach(() => {
    vi.spyOn(tokenGeneratorMock, "generateInternalToken").mockImplementation(
      generateInternalTokenMock
    );
    const refreshableInternalTokenSpy = vi
      .spyOn(refreshableTokenMock, "get")
      .mockImplementation(generateInternalTokenMock);

    const selfcareUpsertTenantSpy = vi
      .spyOn(mockTenantProcessClient.selfcare, "selfcareUpsertTenant")
      .mockImplementation(selfcareUpsertTenantMock);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("should skip empty message", async () => {
    const message = { ...kafkaMessage, value: null };

    await configuredProcessor(message, 0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });

  it("should throw an error if message is malformed", async () => {
    const message = {
      ...kafkaMessage,
      value: Buffer.from('{ not-a : "correct-json"'),
    };

    await expect(() => configuredProcessor(message, 0)).rejects.toThrowError(
      /Error.*partition.*offset.*Reason/
    );

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });

  it("should skip message not containing required product", async () => {
    const message = {
      ...kafkaMessage,
      value: Buffer.from(
        JSON.stringify({ ...correctEventPayload, product: "another-product" })
      ),
    };

    await configuredProcessor(message, 0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });

  it("should throw an error if message has unexpected schema", async () => {
    const message = {
      ...kafkaMessage,
      value: Buffer.from(
        `{ "product" : "${interopProductName}", "this-schema" : "was-unexpected" }`
      ),
    };

    await expect(() => configuredProcessor(message, 0)).rejects.toThrowError(
      /Error.*partition.*offset.*Reason/
    );

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });

  it("should upsert tenant on correct message", async () => {
    const message = kafkaMessage;

    await configuredProcessor(message, 0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
  });

  it("should upsert PA tenant - Main institution", async () => {
    const message = {
      ...kafkaMessage,
      value: Buffer.from(
        JSON.stringify({
          ...correctEventPayload,
          institution: {
            ...correctInstitutionEventField,
            origin: "IPA",
            originId: "ipa_123",
            subUnitType: null,
            subUnitCode: null,
          },
        })
      ),
    };

    await configuredProcessor(message, 0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "IPA", value: "ipa_123" },
        selfcareId: correctEventPayload.internalIstitutionID,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({ bearerToken: interopToken.serialized })
    );
  });

  it("should upsert PA tenant - AOO/UO", async () => {
    const message = {
      ...kafkaMessage,
      value: Buffer.from(
        JSON.stringify({
          ...correctEventPayload,
          institution: {
            ...correctInstitutionEventField,
            origin: "IPA",
            originId: "ipa_123",
            subUnitType: "AOO",
            subUnitCode: "AOO_456",
          },
        })
      ),
    };

    await configuredProcessor(message, 0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "IPA", value: "AOO_456" },
        selfcareId: correctEventPayload.internalIstitutionID,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({ bearerToken: interopToken.serialized })
    );
  });

  it("should upsert non-PA tenant with allowed origin", async () => {
    const message = {
      ...kafkaMessage,
      value: Buffer.from(
        JSON.stringify({
          ...correctEventPayload,
          institution: {
            ...correctInstitutionEventField,
            origin: "ANAC",
            originId: "ipa_123",
            taxCode: "tax789",
            subUnitType: null,
            subUnitCode: null,
          },
        })
      ),
    };

    await configuredProcessor(message, 0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "ANAC", value: "tax789" },
        selfcareId: correctEventPayload.internalIstitutionID,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({ bearerToken: interopToken.serialized })
    );
  });

  it("should upsert non-PA tenant with missing tax code", async () => {
    const message = {
      ...kafkaMessage,
      value: Buffer.from(
        JSON.stringify({
          ...correctEventPayload,
          institution: {
            ...correctInstitutionEventField,
            origin: "ANAC",
            originId: "anac_123",
            taxCode: undefined,
            subUnitType: null,
            subUnitCode: null,
          },
        })
      ),
    };

    await configuredProcessor(message, 0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "ANAC", value: "anac_123" },
        selfcareId: correctEventPayload.internalIstitutionID,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({ bearerToken: interopToken.serialized })
    );
  });

  it("should upsert non-PA tenant with null tax code", async () => {
    const message = {
      ...kafkaMessage,
      value: Buffer.from(
        JSON.stringify({
          ...correctEventPayload,
          institution: {
            ...correctInstitutionEventField,
            origin: "ANAC",
            originId: "anac_123",
            taxCode: null,
            subUnitType: null,
            subUnitCode: null,
          },
        })
      ),
    };

    await configuredProcessor(message, 0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "ANAC", value: "anac_123" },
        selfcareId: correctEventPayload.internalIstitutionID,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({ bearerToken: interopToken.serialized })
    );
  });

  it("should skip upsert of tenant with not allowed origin", async () => {
    const message = {
      ...kafkaMessage,
      value: Buffer.from(
        JSON.stringify({
          ...correctEventPayload,
          institution: {
            ...correctInstitutionEventField,
            origin: "not-allowed",
            originId: "ipa_123",
            taxCode: "tax789",
            subUnitType: null,
            subUnitCode: null,
          },
        })
      ),
    };

    await configuredProcessor(message, 0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });
});
