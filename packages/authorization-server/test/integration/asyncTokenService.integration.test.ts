/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockTokenGenStatesConsumerClient,
  getMockPurpose,
  getMockPurposeVersion,
  writeTokenGenStatesConsumerClient,
  writePlatformCatalogEntry,
  getMockClientAssertion,
  getMockContext,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import {
  ClientId,
  CorrelationId,
  generateId,
  InteractionId,
  interactionState,
  itemState,
  makeGSIPKClientIdKid,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesCatalogEntry,
  Purpose,
  PurposeId,
  purposeVersionState,
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
import { config } from "../../src/config/config.js";
import {
  asyncScopeNotYetImplemented,
  catalogEntryNotFound,
  purposeIdNotProvided,
  urlCallbackNotProvided,
} from "../../src/model/domain/errors.js";
import { readInteraction } from "../../src/utilities/interactionsUtils.js";
import { deconstructGSIPK_eserviceId_descriptorId } from "../../src/utilities/tokenServiceHelpers.js";
import {
  asyncTokenService,
  configTokenGenerationStates,
  dynamoDBClient,
} from "../integrationUtils.js";
import { mockKMSClient, mockProducer } from "../mockUtils.js";

/**
 * Sets up a consumer client in token-generation-states for async token tests.
 * Returns all artifacts needed to call the async token service.
 */
const setupConsumerClient = async (
  customClaims: Record<string, unknown> = {}
): Promise<{
  jws: string;
  clientId: ClientId;
  purpose: Purpose;
  tokenClientPurposeEntry: TokenGenerationStatesConsumerClient;
  catalogEntry: PlatformStatesCatalogEntry;
}> => {
  const purpose: Purpose = {
    ...getMockPurpose(),
    versions: [getMockPurposeVersion(purposeVersionState.active)],
  };
  const clientId = generateId<ClientId>();

  const { jws, clientAssertion, publicKeyEncodedPem } =
    await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: {
        purposeId: purpose.id,
        urlCallback: "https://callback.example.com",
        scope: interactionState.startInteraction,
        ...customClaims,
      },
    });

  const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK({
    clientId,
    kid: clientAssertion.header.kid!,
    purposeId: purpose.id,
  });

  const tokenClientPurposeEntry: TokenGenerationStatesConsumerClient = {
    ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
    consumerId: purpose.consumerId,
    GSIPK_purposeId: purpose.id,
    purposeState: itemState.active,
    purposeVersionId: purpose.versions[0].id,
    agreementState: itemState.active,
    descriptorState: itemState.active,
    asyncExchange: true,
    GSIPK_clientId: clientId,
    GSIPK_clientId_kid: makeGSIPKClientIdKid({
      clientId,
      kid: clientAssertion.header.kid!,
    }),
    publicKey: publicKeyEncodedPem,
  };

  // Extract eserviceId and descriptorId from GSIPK to create matching catalog entry
  const { eserviceId, descriptorId } = deconstructGSIPK_eserviceId_descriptorId(
    tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!
  );

  const catalogEntry: PlatformStatesCatalogEntry = {
    PK: makePlatformStatesEServiceDescriptorPK({
      eserviceId,
      descriptorId,
    }),
    state: itemState.active,
    version: 1,
    updatedAt: new Date().toISOString(),
    descriptorAudience: tokenClientPurposeEntry.descriptorAudience!,
    descriptorVoucherLifespan:
      tokenClientPurposeEntry.descriptorVoucherLifespan!,
    asyncExchange: true,
    asyncExchangeProperties: {
      responseTime: 30,
      resourceAvailableTime: 60,
      confirmation: false,
      bulk: false,
      maxResultSet: 100,
    },
  };

  await Promise.all([
    writeTokenGenStatesConsumerClient(tokenClientPurposeEntry, dynamoDBClient),
    writePlatformCatalogEntry(catalogEntry, dynamoDBClient),
  ]);

  return { jws, clientId, purpose, tokenClientPurposeEntry, catalogEntry };
};

describe("async token service - start_interaction", () => {
  if (!configTokenGenerationStates) {
    fail();
  }
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
    mockKMSClient.send.mockImplementation(async () => ({
      Signature: "mock signature",
    }));
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
    mockProducer.send.mockClear();
    vi.restoreAllMocks();
  });

  const callAsyncTokenService = async (
    jws: string,
    clientId: ClientId,
    correlationId?: CorrelationId
  ) =>
    asyncTokenService.generateAsyncToken(
      {},
      {
        client_id: clientId,
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: jws,
        grant_type: "client_credentials",
      },
      () =>
        getMockContext({
          correlationId: correlationId ?? generateId<CorrelationId>(),
        }),
      () => {},
      () => {},
      () => {}
    );

  it("should generate token for start_interaction scope", async () => {
    mockProducer.send.mockImplementationOnce(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { jws, clientId } = await setupConsumerClient();
    const result = await callAsyncTokenService(jws, clientId);

    expect(result.limitReached).toBe(false);
    if (result.limitReached) {
      fail();
    }
    expect(result.tokenGenerated).toBe(true);
    if (!result.tokenGenerated) {
      fail();
    }
    expect(result.token).toBeDefined();
    expect(result.token.serialized).toBeDefined();
    expect(result.isDPoP).toBe(false);
    expect(result.rateLimiterStatus).toEqual({
      maxRequests: config.rateLimiterMaxRequests,
      rateInterval: config.rateLimiterRateInterval,
      remainingRequests: config.rateLimiterMaxRequests - 1,
    });
  });

  it("should create an interaction record in DynamoDB", async () => {
    mockProducer.send.mockImplementationOnce(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { jws, clientId, purpose, tokenClientPurposeEntry } =
      await setupConsumerClient();
    const result = await callAsyncTokenService(jws, clientId);

    expect(result.limitReached).toBe(false);
    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }

    // Verify the token has async-specific claims
    const token = result.token;
    if (!("interactionId" in token.payload)) {
      fail("Expected async consumer token with interactionId");
    }
    expect(token.payload.scope).toBe(interactionState.startInteraction);
    expect(token.payload.urlCallback).toBe("https://callback.example.com");
    expect(token.payload.interactionId).toBeDefined();

    // Verify interaction was created in DynamoDB
    const interaction = await readInteraction(
      dynamoDBClient,
      token.payload.interactionId,
      config.interactionsTable
    );

    if (!interaction) {
      fail("Expected interaction record in DynamoDB");
    }
    expect(interaction.state).toBe(interactionState.startInteraction);
    expect(interaction.purposeId).toBe(purpose.id);
    expect(interaction.startInteractionTokenIssuedAt).toBeDefined();
    expect(interaction.updatedAt).toBeDefined();

    // Verify eServiceId and descriptorId from the key
    const { eserviceId, descriptorId } =
      deconstructGSIPK_eserviceId_descriptorId(
        tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!
      );
    expect(interaction.eServiceId).toBe(eserviceId);
    expect(interaction.descriptorId).toBe(descriptorId);
  });

  it("should throw urlCallbackNotProvided when urlCallback is missing", async () => {
    const { jws, clientId } = await setupConsumerClient({
      urlCallback: undefined,
    });

    await expect(callAsyncTokenService(jws, clientId)).rejects.toThrowError(
      urlCallbackNotProvided(clientId)
    );
  });

  it("should throw purposeIdNotProvided when purposeId is missing", async () => {
    const clientId = generateId<ClientId>();

    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: {
        scope: interactionState.startInteraction,
        urlCallback: "https://callback.example.com",
      },
    });

    await expect(callAsyncTokenService(jws, clientId)).rejects.toThrowError(
      purposeIdNotProvided(clientId)
    );
  });

  it("should throw asyncScopeNotYetImplemented for callback_invocation scope", async () => {
    const clientId = generateId<ClientId>();
    const purposeId = generateId<PurposeId>();

    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: {
        purposeId,
        urlCallback: "https://callback.example.com",
        scope: interactionState.callbackInvocation,
        interactionId: generateId<InteractionId>(),
      },
    });

    await expect(callAsyncTokenService(jws, clientId)).rejects.toThrowError(
      asyncScopeNotYetImplemented(interactionState.callbackInvocation)
    );
  });

  it("should throw catalogEntryNotFound when catalog entry is missing", async () => {
    const purpose: Purpose = {
      ...getMockPurpose(),
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
        customClaims: {
          purposeId: purpose.id,
          urlCallback: "https://callback.example.com",
          scope: interactionState.startInteraction,
        },
      });

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId: purpose.id,
      }
    );

    const tokenClientPurposeEntry: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
      consumerId: purpose.consumerId,
      GSIPK_purposeId: purpose.id,
      purposeState: itemState.active,
      purposeVersionId: purpose.versions[0].id,
      agreementState: itemState.active,
      descriptorState: itemState.active,
      asyncExchange: true,
      GSIPK_clientId: clientId,
      GSIPK_clientId_kid: makeGSIPKClientIdKid({
        clientId,
        kid: clientAssertion.header.kid!,
      }),
      publicKey: publicKeyEncodedPem,
    };

    // Write only the token entry, NOT the catalog entry
    await writeTokenGenStatesConsumerClient(
      tokenClientPurposeEntry,
      dynamoDBClient
    );

    const { eserviceId, descriptorId } =
      deconstructGSIPK_eserviceId_descriptorId(
        tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!
      );

    await expect(callAsyncTokenService(jws, clientId)).rejects.toThrowError(
      catalogEntryNotFound(eserviceId, descriptorId)
    );
  });

  it("should block the request because of the rate limiter", async () => {
    const { jws, clientId } = await setupConsumerClient();

    // Exhaust rate limit by reusing the same JWS
    // eslint-disable-next-line functional/no-let
    for (let i = 0; i < config.rateLimiterMaxRequests; i++) {
      const response = await callAsyncTokenService(jws, clientId);
      expect(response.limitReached).toBe(false);
    }

    // Next request should be rate limited
    const result = await callAsyncTokenService(jws, clientId);
    expect(result.limitReached).toBe(true);
  });

  it("should generate DPoP token when DPoP proof is provided", async () => {
    mockProducer.send.mockImplementationOnce(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { jws, clientId } = await setupConsumerClient();
    const { dpopProofJWS } = await getMockDPoPProof();

    const result = await asyncTokenService.generateAsyncToken(
      { DPoP: dpopProofJWS },
      {
        client_id: clientId,
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: jws,
        grant_type: "client_credentials",
      },
      () => getMockContext({}),
      () => {},
      () => {},
      () => {}
    );

    expect(result.limitReached).toBe(false);
    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }
    expect(result.isDPoP).toBe(true);
    if (!("cnf" in result.token.payload)) {
      fail("Expected DPoP token with cnf claim");
    }
    expect(result.token.payload.cnf).toBeDefined();
  });
});
