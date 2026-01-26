/* eslint-disable prefer-const */
/* eslint-disable functional/no-let */
import { EachMessagePayload } from "kafkajs";
import {
  getInteropHeaders,
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import { tenantProcessClientBuilder } from "../src/clients/tenantProcessClient.js";
import { config } from "../src/config/config.js";
import { selfcareOnboardingProcessorBuilder } from "../src/services/selfcareOnboardingProcessor.js";
import {
  allowedOrigins,
  correctEventPayload,
  correctInstitutionEventField,
  generateInternalTokenMock,
  interopInternalToken,
  interopProductName,
  kafkaMessagePayload,
  selfcareUpsertTenantMock,
  uuidRegexp,
} from "./utils.js";

describe("Message processor", () => {
  let tenantProcessClientMock: Pick<tenantApi.TenantProcessClient, "selfcare"> =
    tenantProcessClientBuilder(config.tenantProcessUrl);
  let tokenGeneratorMock = new InteropTokenGenerator(config);
  let refreshableTokenMock = new RefreshableInteropToken(tokenGeneratorMock);
  let selfcareOnboardingProcessor: ReturnType<
    typeof selfcareOnboardingProcessorBuilder
  >;

  beforeAll(async () => {
    selfcareOnboardingProcessor = selfcareOnboardingProcessorBuilder(
      refreshableTokenMock,
      tenantProcessClientMock,
      interopProductName,
      allowedOrigins
    );
  });

  let refreshableInternalTokenSpy: MockInstance;
  let selfcareUpsertTenantSpy: MockInstance;

  beforeEach(() => {
    vi.spyOn(tokenGeneratorMock, "generateInternalToken").mockImplementation(
      generateInternalTokenMock
    );
    refreshableInternalTokenSpy = vi
      .spyOn(refreshableTokenMock, "get")
      .mockImplementation(generateInternalTokenMock);

    selfcareUpsertTenantSpy = vi
      .spyOn(tenantProcessClientMock.selfcare, "selfcareUpsertTenant")
      .mockImplementation(selfcareUpsertTenantMock);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("should skip empty message", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: { ...kafkaMessagePayload.message, value: null },
    };

    await selfcareOnboardingProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });

  it("should throw an error if message is malformed", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
        value: Buffer.from('{ not-a : "correct-json"'),
      },
    };

    await expect(() =>
      selfcareOnboardingProcessor.processMessage(message)
    ).rejects.toThrowError(/Error.*partition.*offset.*Reason/);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });

  it("should skip message not containing required product", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
        value: Buffer.from(
          JSON.stringify({ ...correctEventPayload, product: "another-product" })
        ),
      },
    };

    await selfcareOnboardingProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });

  it("should throw an error if message has unexpected schema", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
        value: Buffer.from(
          `{ "product" : "${interopProductName}", "this-schema" : "was-unexpected" }`
        ),
      },
    };

    await expect(() =>
      selfcareOnboardingProcessor.processMessage(message)
    ).rejects.toThrowError(/Error.*partition.*offset.*Reason/);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });

  it("should upsert tenant on correct message", async () => {
    const message = kafkaMessagePayload;

    await selfcareOnboardingProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
  });

  it("should upsert PA tenant - Main institution", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
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
      },
    };

    await selfcareOnboardingProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "IPA", value: "ipa_123" },
        selfcareId: correctEventPayload.institutionId,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({
        headers: getInteropHeaders({
          token: interopInternalToken.serialized,
          correlationId: expect.stringMatching(uuidRegexp),
        }),
      })
    );
  });

  it("should upsert PA tenant - AOO/UO", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
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
      },
    };

    await selfcareOnboardingProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "IPA", value: "AOO_456" },
        selfcareId: correctEventPayload.institutionId,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({
        headers: getInteropHeaders({
          token: interopInternalToken.serialized,
          correlationId: expect.stringMatching(uuidRegexp),
        }),
      })
    );
  });

  it("should upsert non-PA tenant with allowed origin", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
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
      },
    };

    await selfcareOnboardingProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "ANAC", value: "tax789" },
        selfcareId: correctEventPayload.institutionId,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({
        headers: getInteropHeaders({
          token: interopInternalToken.serialized,
          correlationId: expect.stringMatching(uuidRegexp),
        }),
      })
    );
  });
  it.each(["SCP", "PRV", "PT"])(
    "should upsert tenant with institutionType %s correctly",
    async (institutionType) => {
      const origin = "INFOCAMERE";

      const message: EachMessagePayload = {
        ...kafkaMessagePayload,
        message: {
          ...kafkaMessagePayload.message,
          value: Buffer.from(
            JSON.stringify({
              ...correctEventPayload,
              institution: {
                ...correctInstitutionEventField,
                origin,
                institutionType,
                taxCode: "tax789",
              },
            })
          ),
        },
      };

      await selfcareOnboardingProcessor.processMessage(message);

      const expectedOrigin = origin + "-" + institutionType;
      expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
      expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: { origin: expectedOrigin, value: "tax789" },
          selfcareId: correctEventPayload.institutionId,
          name: correctInstitutionEventField.description,
        }),
        expect.objectContaining({
          headers: getInteropHeaders({
            token: interopInternalToken.serialized,
            correlationId: expect.stringMatching(uuidRegexp),
          }),
        })
      );
    }
  );
  it("should upsert non-PA tenant with missing tax code", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
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
      },
    };

    await selfcareOnboardingProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "ANAC", value: "anac_123" },
        selfcareId: correctEventPayload.institutionId,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({
        headers: getInteropHeaders({
          token: interopInternalToken.serialized,
          correlationId: expect.stringMatching(uuidRegexp),
        }),
      })
    );
  });

  it("should upsert non-PA tenant with null tax code", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
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
      },
    };

    await selfcareOnboardingProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(1);
    expect(selfcareUpsertTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: { origin: "ANAC", value: "anac_123" },
        selfcareId: correctEventPayload.institutionId,
        name: correctInstitutionEventField.description,
      }),
      expect.objectContaining({
        headers: getInteropHeaders({
          token: interopInternalToken.serialized,
          correlationId: expect.stringMatching(uuidRegexp),
        }),
      })
    );
  });

  it("should skip upsert of tenant with not allowed origin", async () => {
    const message: EachMessagePayload = {
      ...kafkaMessagePayload,
      message: {
        ...kafkaMessagePayload.message,
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
      },
    };

    await selfcareOnboardingProcessor.processMessage(message);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(selfcareUpsertTenantSpy).toBeCalledTimes(0);
  });
});
