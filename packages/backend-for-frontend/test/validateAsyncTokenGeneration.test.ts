import { beforeEach, describe, expect, it, vi } from "vitest";
import { marshall } from "@aws-sdk/util-dynamodb";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { bffApi, authorizationApi } from "pagopa-interop-api-clients";
import * as clientAssertionValidation from "pagopa-interop-client-assertion-validation";
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
import { toolsServiceBuilder } from "../src/services/toolService.js";
import { getBffMockContext } from "./utils.js";

describe("validateAsyncTokenGeneration", () => {
  const mockClientId = generateId<ClientId>();
  const mockPurposeId = generateId<PurposeId>();
  const mockEServiceId = generateId<EServiceId>();
  const mockDescriptorId = generateId();
  const mockInteractionId = generateId<InteractionId>();
  const mockKid = "kid-1";
  const mockClientAssertion = "client-assertion";
  const mockClientAssertionType =
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
  const mockGrantType = "client_credentials";

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

    const result = await service.validateAsyncTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
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

    const result = await service.validateAsyncTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
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
          entityNumber: 1,
        },
      },
    });

    dynamoDBClient.send = vi.fn().mockResolvedValueOnce({
      Items: [
        marshall({
          PK: `INTERACTION#${mockInteractionId}`,
          GSIPK_interactionId: makeGSIPKInteractionId(mockInteractionId),
          interactionId: mockInteractionId,
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

    const result = await service.validateAsyncTokenGeneration(
      producerClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
      ctx
    );

    expect(result.steps.clientAssertionValidation.result).toBe("PASSED");
    expect(result.steps.publicKeyRetrieve.result).toBe("PASSED");
    expect(result.steps.clientAssertionSignatureVerification.result).toBe(
      "PASSED"
    );
    expect(result.steps.platformStatesVerification.result).toBe("PASSED");
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

    const result = await service.validateAsyncTokenGeneration(
      mockClientId,
      mockClientAssertion,
      mockClientAssertionType,
      mockGrantType,
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
});
