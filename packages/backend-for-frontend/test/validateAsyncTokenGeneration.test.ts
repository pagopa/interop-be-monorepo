import { beforeEach, describe, expect, it, vi } from "vitest";
import { marshall } from "@aws-sdk/util-dynamodb";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { bffApi, authorizationApi } from "pagopa-interop-api-clients";
import * as clientAssertionValidation from "pagopa-interop-client-assertion-validation";
import * as dpopValidation from "pagopa-interop-dpop-validation";
import {
  ClientId,
  EServiceId,
  generateId,
  InteractionId,
  interactionState,
  makeGSIPKInteractionId,
  ProducerKeychainId,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";
import { toolsServiceBuilder } from "../src/services/toolService.js";
import { getBffMockContext } from "./utils.js";

describe("validateTokenGeneration async validations", () => {
  const mockClientId = generateId<ClientId>();
  const mockPurposeId = generateId<PurposeId>();
  const mockEServiceId = generateId<EServiceId>();
  const mockDescriptorId = generateId();
  const mockInteractionId = generateId<InteractionId>();
  const mockKid = "kid-1";
  const mockClientAssertion = `header.${Buffer.from(
    JSON.stringify({ scope: interactionState.startInteraction })
  ).toString("base64url")}.signature`;
  const mockClientAssertionType =
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
  const mockGrantType = "client_credentials";
  const mockDpopProof = "test_dpop_proof_jws";
  const mockDpopHtuBase = "test/authorization-server/token.oauth2";
  const mockDpopIatToleranceSeconds = 60;
  const mockDpopDurationSeconds = 60;

  const mockAuthData: AuthData = {
    ...getMockAuthData(),
    organizationId: generateId(),
  };

  const ctx = getBffMockContext(
    getMockContext({
      authData: mockAuthData,
    })
  );

  const mockClients = {
    authorizationClient: {
      token: {
        getKeyWithClientByKeyId: vi.fn().mockResolvedValue({
          client: {
            id: mockClientId,
            consumerId: mockAuthData.organizationId,
            kind: authorizationApi.ClientKind.enum.CONSUMER,
          },
        }),
      },
      client: {
        getClientKeyById: vi
          .fn()
          .mockResolvedValue({ encodedPem: "publicKey" }),
      },
      producerKeychain: {
        getProducerKeychain: vi.fn().mockResolvedValue({
          visibility: authorizationApi.Visibility.Values.FULL,
          id: generateId<ProducerKeychainId>(),
          producerId: generateId(),
          name: "Producer keychain",
          createdAt: new Date().toISOString(),
          eservices: [mockEServiceId],
          description: "Producer keychain description",
          users: [],
          keys: [],
        }),
        getProducerKeyById: vi
          .fn()
          .mockResolvedValue({ encodedPem: "producerPublicKey" }),
      },
    },
    purposeProcessClient: {
      getPurpose: vi.fn().mockResolvedValue({
        id: mockPurposeId,
        consumerId: mockAuthData.organizationId,
        eserviceId: mockEServiceId,
        versions: [
          {
            id: generateId(),
            createdAt: new Date().toISOString(),
            state: "ACTIVE",
          },
        ],
      }),
    },
    agreementProcessClient: {
      getAgreements: vi.fn().mockResolvedValue({
        results: [
          {
            id: generateId(),
            eserviceId: mockEServiceId,
            descriptorId: mockDescriptorId,
            state: "ACTIVE",
          },
        ],
      }),
    } as unknown as PagoPAInteropBeClients["agreementProcessClient"],
    catalogProcessClient: {
      getEServiceById: vi.fn().mockResolvedValue({
        id: mockEServiceId,
        name: "Test eService",
        asyncExchange: true,
        descriptors: [
          {
            id: mockDescriptorId,
            version: "1",
            state: "PUBLISHED",
            audience: ["audience"],
            voucherLifespan: 3600,
            asyncExchangeProperties: {
              responseTime: 60,
              resourceAvailableTime: 120,
              confirmation: true,
              bulk: false,
              maxResultSet: 100,
            },
          },
        ],
      }),
    },
  } as unknown as PagoPAInteropBeClients;

  const dynamoDBClient = {
    send: vi.fn(),
  };

  const service = toolsServiceBuilder(mockClients, {
    dynamoDBClient: dynamoDBClient as never,
    interactionsTable: "interactions",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    dynamoDBClient.send = vi.fn();
    config.featureFlagDpopClientAssertionDebugger = false;

    vi.spyOn(
      clientAssertionValidation,
      "validateRequestParameters"
    ).mockReturnValue({
      errors: undefined,
      data: {
        client_assertion: mockClientAssertion,
        client_assertion_type: mockClientAssertionType,
        grant_type: mockGrantType,
        client_id: mockClientId,
      },
    });

    vi.spyOn(
      clientAssertionValidation,
      "verifyClientAssertionSignature"
    ).mockResolvedValue({ errors: undefined, data: {} });
  });

  it("should include DPoP validation when validating async token generation", async () => {
    Object.assign(config, {
      featureFlagDpopClientAssertionDebugger: true,
      dpopHtuBase: mockDpopHtuBase,
      dpopIatToleranceSeconds: mockDpopIatToleranceSeconds,
      dpopDurationSeconds: mockDpopDurationSeconds,
    });

    vi.spyOn(dpopValidation, "verifyDPoPProof").mockReturnValue({
      errors: undefined,
      data: {
        dpopProofJWT: {
          header: {
            alg: "RS256",
            typ: "dpop+jwt",
            jwk: { kty: "RSA", n: "...", e: "..." },
          },
          payload: {
            jti: "123",
            iat: 123,
            htu: mockDpopHtuBase,
            htm: "POST",
          },
        },
        dpopProofJWS: mockDpopProof,
      },
    });
    vi.spyOn(dpopValidation, "verifyDPoPProofSignature").mockResolvedValue({
      errors: undefined,
      data: {},
    });
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          purposeId: mockPurposeId,
          scope: interactionState.startInteraction,
          urlCallback: "https://example.com/callback",
        },
      },
    });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      mockDpopProof,
      ctx
    );

    expect(result.steps.dpopValidation).toEqual({
      result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
      failures: [],
    });
    expect(dpopValidation.verifyDPoPProof).toHaveBeenCalledWith({
      dpopProofJWS: mockDpopProof,
      expectedDPoPProofHtu: mockDpopHtuBase,
      expectedDPoPProofHtm: "POST",
      dpopProofIatToleranceSeconds: mockDpopIatToleranceSeconds,
      dpopProofDurationSeconds: mockDpopDurationSeconds,
    });
  });

  it("should validate start_interaction successfully", async () => {
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          purposeId: mockPurposeId,
          scope: interactionState.startInteraction,
          urlCallback: "https://example.com/callback",
        },
      },
    });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.clientKind).toBe(bffApi.ClientKind.Enum.CONSUMER);
    expect(result.steps.clientAssertionValidation.result).toBe("PASSED");
    expect(result.steps.publicKeyRetrieve.result).toBe("PASSED");
    expect(result.steps.clientAssertionSignatureVerification.result).toBe(
      "PASSED"
    );
    expect(result.steps.platformStatesVerification.result).toBe("PASSED");
  });

  it("should fail with async-specific errors when isAsync is true and scope is missing", async () => {
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: [clientAssertionValidation.scopeNotProvided()],
      data: undefined,
    });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.clientAssertionValidation.result).toBe("FAILED");
    expect(result.steps.clientAssertionValidation.failures).toEqual([
      {
        code: "scopeNotProvided",
        reason: "Claim scope does not exist in this assertion",
      },
    ]);
    expect(result.steps.publicKeyRetrieve.result).toBe("SKIPPED");
  });

  it("should fail on missing interaction for get_resource", async () => {
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          scope: interactionState.getResource,
          interactionId: mockInteractionId,
        },
      },
    });

    dynamoDBClient.send = vi.fn().mockResolvedValue({ Items: [] });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.clientAssertionValidation.result).toBe("PASSED");
    expect(result.steps.publicKeyRetrieve.result).toBe("FAILED");
    expect(result.steps.publicKeyRetrieve.failures).toEqual([
      {
        code: "interactionNotFound",
        reason: `Interaction ${mockInteractionId} not found`,
      },
    ]);
    expect(result.steps.clientAssertionSignatureVerification.result).toBe(
      "SKIPPED"
    );
  });

  it("should validate callback_invocation with producer key retrieval", async () => {
    const producerKeychainId = generateId<ProducerKeychainId>();
    const producerClientId = unsafeBrandId<ClientId>(producerKeychainId);
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: producerClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: producerClientId,
          aud: ["audience"],
          scope: interactionState.callbackInvocation,
          interactionId: mockInteractionId,
          entityNumber: 0,
        },
      },
    });

    dynamoDBClient.send = vi.fn().mockResolvedValueOnce({
      Items: [
        marshall({
          PK: `INTERACTION#${mockInteractionId}`,
          GSIPK_interactionId: makeGSIPKInteractionId(mockInteractionId),
          interactionId: mockInteractionId,
          clientId: mockClientId,
          consumerId: mockAuthData.organizationId,
          purposeId: mockPurposeId,
          eServiceId: mockEServiceId,
          descriptorId: mockDescriptorId,
          state: interactionState.startInteraction,
          startInteractionTokenIssuedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ttl: 1,
        }),
      ],
    });

    mockClients.authorizationClient.producerKeychain.getProducerKeychain = vi
      .fn()
      .mockResolvedValue({
        visibility: authorizationApi.Visibility.Values.FULL,
        id: producerKeychainId,
        producerId: generateId(),
        name: "Producer keychain",
        createdAt: new Date().toISOString(),
        eservices: [mockEServiceId],
        description: "Producer keychain description",
        users: [],
        keys: [],
      });

    const result = await service.validateTokenGeneration(
      producerClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.clientAssertionValidation.result).toBe("PASSED");
    expect(result.steps.publicKeyRetrieve.result).toBe("PASSED");
    expect(result.steps.clientAssertionSignatureVerification.result).toBe(
      "PASSED"
    );
    expect(result.steps.platformStatesVerification.result).toBe("PASSED");
  });

  it("should fail callback_invocation when entityNumber is negative", async () => {
    const producerKeychainId = generateId<ProducerKeychainId>();
    const producerClientId = unsafeBrandId<ClientId>(producerKeychainId);

    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: producerClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: producerClientId,
          aud: ["audience"],
          scope: interactionState.callbackInvocation,
          interactionId: mockInteractionId,
          entityNumber: -1,
        },
      },
    });

    const result = await service.validateTokenGeneration(
      producerClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.clientAssertionValidation.result).toBe("FAILED");
    expect(result.steps.clientAssertionValidation.failures).toEqual([
      {
        code: "invalidEntityNumber",
        reason: `entityNumber -1 is not valid for client ${producerClientId} - must be greater than or equal to 0`,
      },
    ]);
    expect(result.steps.publicKeyRetrieve.result).toBe("SKIPPED");
  });

  it("should fall back to a strongly consistent PK lookup when the GSI misses", async () => {
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          scope: interactionState.getResource,
          interactionId: mockInteractionId,
        },
      },
    });

    dynamoDBClient.send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({
        Item: marshall({
          PK: `INTERACTION#${mockInteractionId}`,
          GSIPK_interactionId: makeGSIPKInteractionId(mockInteractionId),
          interactionId: mockInteractionId,
          clientId: mockClientId,
          consumerId: mockAuthData.organizationId,
          purposeId: mockPurposeId,
          eServiceId: mockEServiceId,
          descriptorId: mockDescriptorId,
          state: interactionState.callbackInvocation,
          callbackInvocationTokenIssuedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ttl: 1,
        }),
      });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.publicKeyRetrieve.result).toBe("PASSED");
    expect(result.steps.platformStatesVerification.result).toBe("PASSED");
    expect(dynamoDBClient.send).toHaveBeenCalledTimes(2);
  });

  it("should fail confirmation when confirmation flag is disabled", async () => {
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          scope: interactionState.confirmation,
          interactionId: mockInteractionId,
        },
      },
    });

    dynamoDBClient.send = vi.fn().mockResolvedValueOnce({
      Items: [
        marshall({
          PK: `INTERACTION#${mockInteractionId}`,
          GSIPK_interactionId: makeGSIPKInteractionId(mockInteractionId),
          interactionId: mockInteractionId,
          clientId: mockClientId,
          consumerId: mockAuthData.organizationId,
          purposeId: mockPurposeId,
          eServiceId: mockEServiceId,
          descriptorId: mockDescriptorId,
          state: interactionState.getResource,
          callbackInvocationTokenIssuedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ttl: 1,
        }),
      ],
    });

    mockClients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue({
        id: mockEServiceId,
        name: "Test eService",
        asyncExchange: true,
        descriptors: [
          {
            id: mockDescriptorId,
            version: "1",
            state: "PUBLISHED",
            audience: ["audience"],
            voucherLifespan: 3600,
            asyncExchangeProperties: {
              responseTime: 60,
              resourceAvailableTime: 120,
              confirmation: false,
              bulk: false,
              maxResultSet: 100,
            },
          },
        ],
      });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.platformStatesVerification.result).toBe("FAILED");
    expect(result.steps.platformStatesVerification.failures).toEqual([
      {
        code: "asyncExchangeConfirmationNotEnabled",
        reason: `Async exchange confirmation is not enabled for the eService associated with interaction ${mockInteractionId}`,
      },
    ]);
  });

  it("should fail start_interaction when asyncExchangeProperties are missing", async () => {
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          purposeId: mockPurposeId,
          scope: interactionState.startInteraction,
          urlCallback: "https://example.com/callback",
        },
      },
    });

    mockClients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue({
        id: mockEServiceId,
        name: "Test eService",
        asyncExchange: true,
        descriptors: [
          {
            id: mockDescriptorId,
            version: "1",
            state: "PUBLISHED",
            audience: ["audience"],
            voucherLifespan: 3600,
          },
        ],
      });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.platformStatesVerification.result).toBe("FAILED");
    expect(result.steps.platformStatesVerification.failures).toEqual([
      {
        code: "platformStateValidationFailed",
        reason: `Platform state validation failed - Missing asyncExchangeProperties for client ${mockClientId}`,
      },
    ]);
  });

  it("get_resource fails when jwt.sub differs from interaction.clientId (same tenant)", async () => {
    const differentClientId = generateId<ClientId>();

    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: differentClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: differentClientId,
          aud: ["audience"],
          scope: interactionState.getResource,
          interactionId: mockInteractionId,
        },
      },
    });

    dynamoDBClient.send = vi.fn().mockResolvedValueOnce({
      Items: [
        marshall({
          PK: `INTERACTION#${mockInteractionId}`,
          interactionId: mockInteractionId,
          clientId: mockClientId,
          consumerId: mockAuthData.organizationId,
          purposeId: mockPurposeId,
          eServiceId: mockEServiceId,
          descriptorId: mockDescriptorId,
          state: interactionState.getResource,
          callbackInvocationTokenIssuedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ttl: 1,
        }),
      ],
    });

    mockClients.authorizationClient.token.getKeyWithClientByKeyId = vi
      .fn()
      .mockResolvedValue({
        client: {
          id: differentClientId,
          consumerId: mockAuthData.organizationId,
          kind: authorizationApi.ClientKind.enum.CONSUMER,
        },
      });

    const result = await service.validateTokenGeneration(
      differentClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.publicKeyRetrieve.result).toBe("FAILED");
    expect(result.steps.publicKeyRetrieve.failures).toEqual([
      {
        code: "interactionClientIdMismatch",
        reason: `Client ${differentClientId} did not start interaction ${mockInteractionId}`,
      },
    ]);
    expect(result.steps.clientAssertionSignatureVerification.result).toBe(
      "SKIPPED"
    );
  });

  it("returns a structured clientAssertionValidation failure when async storage is not configured", async () => {
    const serviceWithoutStorage = toolsServiceBuilder(mockClients, undefined);

    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          purposeId: mockPurposeId,
          scope: interactionState.startInteraction,
          urlCallback: "https://example.com/callback",
        },
      },
    });

    const result = await serviceWithoutStorage.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.clientAssertionValidation.result).toBe("FAILED");
    expect(
      result.steps.clientAssertionValidation.failures.some(
        (f) => f.code === "asyncStorageNotConfigured"
      )
    ).toBe(true);
    expect(result.steps.publicKeyRetrieve.result).toBe("SKIPPED");
  });

  it("resourceAvailableTimeExpired is detected when callbackInvocationTokenIssuedAt is too old", async () => {
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          scope: interactionState.getResource,
          interactionId: mockInteractionId,
        },
      },
    });

    const expiredTimestamp = new Date(Date.now() - 200_000).toISOString();
    dynamoDBClient.send = vi.fn().mockResolvedValueOnce({
      Items: [
        marshall({
          PK: `INTERACTION#${mockInteractionId}`,
          interactionId: mockInteractionId,
          clientId: mockClientId,
          consumerId: mockAuthData.organizationId,
          purposeId: mockPurposeId,
          eServiceId: mockEServiceId,
          descriptorId: mockDescriptorId,
          state: interactionState.getResource,
          callbackInvocationTokenIssuedAt: expiredTimestamp,
          updatedAt: new Date().toISOString(),
          ttl: 1,
        }),
      ],
    });

    mockClients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue({
        id: mockEServiceId,
        name: "Test eService",
        asyncExchange: true,
        descriptors: [
          {
            id: mockDescriptorId,
            version: "1",
            state: "PUBLISHED",
            audience: ["audience"],
            voucherLifespan: 3600,
            asyncExchangeProperties: {
              responseTime: 60,
              resourceAvailableTime: 60,
              confirmation: true,
              bulk: false,
              maxResultSet: 100,
            },
          },
        ],
      });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.platformStatesVerification.result).toBe("FAILED");
    expect(
      result.steps.platformStatesVerification.failures.some(
        (f) => f.code === "resourceAvailableTimeExpired"
      )
    ).toBe(true);
  });

  it("asyncExchangeResponseTimeExceeded is detected for callback_invocation when startInteractionTokenIssuedAt is too old", async () => {
    const producerKeychainId = generateId<ProducerKeychainId>();
    const producerClientId = unsafeBrandId<ClientId>(producerKeychainId);

    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: producerClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: producerClientId,
          aud: ["audience"],
          scope: interactionState.callbackInvocation,
          interactionId: mockInteractionId,
          entityNumber: 0,
        },
      },
    });

    const expiredTimestamp = new Date(Date.now() - 200_000).toISOString();
    dynamoDBClient.send = vi.fn().mockResolvedValueOnce({
      Items: [
        marshall({
          PK: `INTERACTION#${mockInteractionId}`,
          interactionId: mockInteractionId,
          clientId: mockClientId,
          consumerId: mockAuthData.organizationId,
          purposeId: mockPurposeId,
          eServiceId: mockEServiceId,
          descriptorId: mockDescriptorId,
          state: interactionState.startInteraction,
          startInteractionTokenIssuedAt: expiredTimestamp,
          updatedAt: new Date().toISOString(),
          ttl: 1,
        }),
      ],
    });

    mockClients.authorizationClient.producerKeychain.getProducerKeychain = vi
      .fn()
      .mockResolvedValue({
        visibility: authorizationApi.Visibility.Values.FULL,
        id: producerKeychainId,
        producerId: generateId(),
        name: "Producer keychain",
        createdAt: new Date().toISOString(),
        eservices: [mockEServiceId],
        description: "Producer keychain description",
        users: [],
        keys: [],
      });

    mockClients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue({
        id: mockEServiceId,
        name: "Test eService",
        asyncExchange: true,
        descriptors: [
          {
            id: mockDescriptorId,
            version: "1",
            state: "PUBLISHED",
            audience: ["audience"],
            voucherLifespan: 3600,
            asyncExchangeProperties: {
              responseTime: 60,
              resourceAvailableTime: 120,
              confirmation: true,
              bulk: false,
              maxResultSet: 100,
            },
          },
        ],
      });

    const result = await service.validateTokenGeneration(
      producerClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.platformStatesVerification.result).toBe("FAILED");
    expect(
      result.steps.platformStatesVerification.failures.some(
        (f) => f.code === "asyncExchangeResponseTimeExceeded"
      )
    ).toBe(true);
  });

  it("interactionStateNotAllowed when interaction is in start_interaction state but scope is get_resource", async () => {
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          scope: interactionState.getResource,
          interactionId: mockInteractionId,
        },
      },
    });

    dynamoDBClient.send = vi.fn().mockResolvedValueOnce({
      Items: [
        marshall({
          PK: `INTERACTION#${mockInteractionId}`,
          interactionId: mockInteractionId,
          clientId: mockClientId,
          consumerId: mockAuthData.organizationId,
          purposeId: mockPurposeId,
          eServiceId: mockEServiceId,
          descriptorId: mockDescriptorId,
          state: interactionState.startInteraction,
          startInteractionTokenIssuedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ttl: 1,
        }),
      ],
    });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.publicKeyRetrieve.result).toBe("FAILED");
    expect(result.steps.publicKeyRetrieve.failures).toEqual([
      {
        code: "interactionStateNotAllowed",
        reason: `Interaction ${mockInteractionId} in state ${interactionState.startInteraction} does not allow scope ${interactionState.getResource}`,
      },
    ]);
  });

  it("asyncExchangeNotEnabled when eService has asyncExchange: false", async () => {
    vi.spyOn(
      clientAssertionValidation,
      "verifyAsyncClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: mockKid, alg: "RS256", typ: "JWT" },
        payload: {
          sub: mockClientId,
          jti: "jti",
          iat: 1,
          exp: 2,
          iss: mockClientId,
          aud: ["audience"],
          scope: interactionState.getResource,
          interactionId: mockInteractionId,
        },
      },
    });

    dynamoDBClient.send = vi.fn().mockResolvedValueOnce({
      Items: [
        marshall({
          PK: `INTERACTION#${mockInteractionId}`,
          interactionId: mockInteractionId,
          clientId: mockClientId,
          consumerId: mockAuthData.organizationId,
          purposeId: mockPurposeId,
          eServiceId: mockEServiceId,
          descriptorId: mockDescriptorId,
          state: interactionState.getResource,
          callbackInvocationTokenIssuedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ttl: 1,
        }),
      ],
    });

    mockClients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue({
        id: mockEServiceId,
        name: "Test eService",
        asyncExchange: false,
        descriptors: [
          {
            id: mockDescriptorId,
            version: "1",
            state: "PUBLISHED",
            audience: ["audience"],
            voucherLifespan: 3600,
            asyncExchangeProperties: {
              responseTime: 60,
              resourceAvailableTime: 120,
              confirmation: true,
              bulk: false,
              maxResultSet: 100,
            },
          },
        ],
      });

    const result = await service.validateTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      true,
      undefined,
      ctx
    );

    expect(result.steps.platformStatesVerification.result).toBe("FAILED");
    expect(
      result.steps.platformStatesVerification.failures.some(
        (f) => f.code === "asyncExchangeNotEnabled"
      )
    ).toBe(true);
  });
});
