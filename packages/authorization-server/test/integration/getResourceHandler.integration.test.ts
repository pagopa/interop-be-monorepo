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
  getMockClientAssertion,
  getMockContext,
  writeTokenGenStatesConsumerClient,
  writePlatformCatalogEntry,
  generateKeySet,
  signJWT,
} from "pagopa-interop-commons-test";
import {
  algorithm,
  ClientId,
  CorrelationId,
  DescriptorId,
  EServiceId,
  generateId,
  InteractionId,
  interactionState,
  itemState,
  makeGSIPKClientIdKid,
  makeGSIPKEServiceIdDescriptorId,
  makeInteractionPK,
  makePlatformStatesEServiceDescriptorPK,
  makeProducerKeychainPlatformStatesPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesCatalogEntry,
  ProducerKeychainId,
  ProducerKeychainPlatformStatesPK,
  Purpose,
  PurposeId,
  purposeVersionState,
  TokenGenerationStatesConsumerClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import { dateToSeconds } from "pagopa-interop-commons";
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { config } from "../../src/config/config.js";
import {
  callbackInvocationTokenIssuedAtMissing,
  interactionIdNotProvided,
  interactionNotFound,
  interactionStateNotAllowed,
} from "../../src/model/domain/errors.js";
import { readInteraction } from "../../src/utilities/interactionsUtils.js";
import {
  asyncTokenService,
  configTokenGenerationStates,
  dynamoDBClient,
} from "../integrationUtils.js";
import { mockKMSClient, mockProducer } from "../mockUtils.js";

const writeProducerKeychainEntry = async (
  entry: {
    PK: ProducerKeychainPlatformStatesPK;
    publicKey: string;
    producerKeychainId: ProducerKeychainId;
    kid: string;
    eServiceId: EServiceId;
    version: number;
    updatedAt: string;
  },
  client: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    TableName: "producer-keychain-platform-states",
    Item: {
      PK: { S: entry.PK },
      publicKey: { S: entry.publicKey },
      producerKeychainId: { S: entry.producerKeychainId },
      kid: { S: entry.kid },
      eServiceId: { S: entry.eServiceId },
      version: { N: entry.version.toString() },
      updatedAt: { S: entry.updatedAt },
    },
  };
  await client.send(new PutItemCommand(input));
};

/**
 * Sets up the full get_resource scenario:
 * 1. Creates a consumer client + start_interaction to get an interaction
 * 2. Creates a producer keychain entry + catalog entry
 * 3. Calls callback_invocation to transition interaction to callback_invocation state
 * 4. Creates a consumer assertion with scope=get_resource
 */
const setupGetResourceScenario = async (overrides?: {
  consumerCustomClaims?: Record<string, unknown>;
  skipCallbackInvocation?: boolean;
  differentConsumerForGetResource?: boolean;
}): Promise<{
  consumerJws: string;
  consumerClientId: ClientId;
  interactionId: InteractionId;
  eServiceId: EServiceId;
  descriptorId: DescriptorId;
  purposeId: PurposeId;
}> => {
  // Step 1: Create consumer client and start_interaction
  // Generate key pair once and reuse for both start_interaction and get_resource
  const purpose: Purpose = {
    ...getMockPurpose(),
    versions: [getMockPurposeVersion(purposeVersionState.active)],
  };
  const consumerClientId = generateId<ClientId>();
  const eServiceId = generateId<EServiceId>();
  const descriptorId = generateId<DescriptorId>();

  const { keySet: consumerKeySet, publicKeyEncodedPem: consumerPublicKey } =
    generateKeySet();
  const consumerKid = "kid";

  const threeHourLaterStart = new Date();
  threeHourLaterStart.setHours(threeHourLaterStart.getHours() + 3);

  const consumerStartJws = await signJWT({
    payload: {
      iss: consumerClientId,
      sub: consumerClientId,
      aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
      exp: dateToSeconds(threeHourLaterStart),
      jti: generateId(),
      iat: dateToSeconds(new Date()),
      purposeId: purpose.id,
      urlCallback: "https://callback.example.com",
      scope: interactionState.startInteraction,
    },
    headers: {
      alg: algorithm.RS256,
      kid: consumerKid,
    },
    keySet: consumerKeySet,
  });

  const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK({
    clientId: consumerClientId,
    kid: consumerKid,
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
    GSIPK_clientId: consumerClientId,
    GSIPK_clientId_kid: makeGSIPKClientIdKid({
      clientId: consumerClientId,
      kid: consumerKid,
    }),
    GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
      eserviceId: eServiceId,
      descriptorId,
    }),
    publicKey: consumerPublicKey,
  };

  await writeTokenGenStatesConsumerClient(
    tokenClientPurposeEntry,
    dynamoDBClient
  );

  // Create platform-states catalog entry BEFORE start_interaction
  // (start_interaction reads it for asyncExchangeProperties and TTL)
  const catalogPK = makePlatformStatesEServiceDescriptorPK({
    eserviceId: eServiceId,
    descriptorId,
  });

  const catalogEntry: PlatformStatesCatalogEntry = {
    PK: catalogPK,
    state: itemState.active,
    descriptorAudience: ["https://eservice.example.com"],
    descriptorVoucherLifespan: 3600,
    asyncExchange: true,
    asyncExchangeProperties: {
      responseTime: 30,
      resourceAvailableTime: 60,
      confirmation: false,
      bulk: false,
      maxResultSet: 100,
    },
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  await writePlatformCatalogEntry(catalogEntry, dynamoDBClient);

  mockProducer.send.mockImplementationOnce(async () => [
    { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
  ]);

  // Call start_interaction to create an interaction
  const startResult = await asyncTokenService.generateAsyncToken(
    {},
    {
      client_id: consumerClientId,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: consumerStartJws,
      grant_type: "client_credentials",
    },
    () => getMockContext({ correlationId: generateId<CorrelationId>() }),
    () => {},
    () => {},
    () => {}
  );

  if (startResult.limitReached || !startResult.tokenGenerated) {
    fail("start_interaction should succeed");
  }

  const interactionId = (startResult.token.payload as { interactionId: string })
    .interactionId as InteractionId;

  if (!overrides?.skipCallbackInvocation) {
    // Step 2: Create producer keychain entry (catalog entry already created above)
    const producerKeychainId = generateId<ProducerKeychainId>();

    const {
      jws: producerJws,
      clientAssertion: producerAssertion,
      publicKeyEncodedPem: producerPublicKey,
    } = await getMockClientAssertion({
      standardClaimsOverride: { sub: producerKeychainId },
      customClaims: {
        scope: interactionState.callbackInvocation,
        interactionId,
        entityNumber: 1,
        urlCallback: "https://callback.example.com",
      },
    });

    const producerKeyPK = makeProducerKeychainPlatformStatesPK({
      producerKeychainId: unsafeBrandId<ProducerKeychainId>(producerKeychainId),
      kid: producerAssertion.header.kid!,
      eServiceId,
    });

    await writeProducerKeychainEntry(
      {
        PK: producerKeyPK,
        publicKey: producerPublicKey,
        producerKeychainId:
          unsafeBrandId<ProducerKeychainId>(producerKeychainId),
        kid: producerAssertion.header.kid!,
        eServiceId,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      dynamoDBClient
    );

    // Step 3: Call callback_invocation to transition interaction
    mockProducer.send.mockImplementationOnce(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const callbackResult = await asyncTokenService.generateAsyncToken(
      {},
      {
        client_id: unsafeBrandId<ClientId>(producerKeychainId),
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: producerJws,
        grant_type: "client_credentials",
      },
      () => getMockContext({ correlationId: generateId<CorrelationId>() }),
      () => {},
      () => {},
      () => {}
    );

    if (callbackResult.limitReached || !callbackResult.tokenGenerated) {
      fail("callback_invocation should succeed");
    }
  }

  // Step 4: Create consumer assertion with scope=get_resource
  // Must reuse the same key pair so the signature matches the public key in token-generation-states
  const getResourceClientId = overrides?.differentConsumerForGetResource
    ? generateId<ClientId>()
    : consumerClientId;

  const threeHourLater = new Date();
  threeHourLater.setHours(threeHourLater.getHours() + 3);

  const consumerGetResourceJws = await signJWT({
    payload: {
      iss: getResourceClientId,
      sub: getResourceClientId,
      aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
      exp: dateToSeconds(threeHourLater),
      jti: generateId(),
      iat: dateToSeconds(new Date()),
      scope: interactionState.getResource,
      interactionId,
      ...overrides?.consumerCustomClaims,
    },
    headers: {
      alg: algorithm.RS256,
      kid: consumerKid,
    },
    keySet: consumerKeySet,
  });

  return {
    consumerJws: consumerGetResourceJws,
    consumerClientId: getResourceClientId,
    interactionId,
    eServiceId,
    descriptorId,
    purposeId: purpose.id,
  };
};

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

describe("async token service - get_resource", () => {
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

  it("should generate token for get_resource scope", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario();
    const result = await callAsyncTokenService(consumerJws, consumerClientId);

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
  });

  it("should verify token claims contain scope=get_resource and no urlCallback", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId, purposeId } =
      await setupGetResourceScenario();
    const result = await callAsyncTokenService(consumerJws, consumerClientId);

    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }

    const payload = result.token.payload as {
      scope: string;
      interactionId: string;
      purposeId: string;
      urlCallback?: string;
    };
    expect(payload.scope).toBe(interactionState.getResource);
    expect(payload.interactionId).toBe(interactionId);
    expect(payload.purposeId).toBe(purposeId);
    expect(payload.urlCallback).toBeUndefined();
  });

  it("should update interaction state to get_resource", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId } =
      await setupGetResourceScenario();
    await callAsyncTokenService(consumerJws, consumerClientId);

    const interaction = await readInteraction(
      dynamoDBClient,
      interactionId,
      config.interactionsTable
    );

    expect(interaction).toBeDefined();
    expect(interaction!.state).toBe(interactionState.getResource);
  });

  it("should allow two calls with get_resource scope (self-loop)", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId } =
      await setupGetResourceScenario();

    // First call
    const result1 = await callAsyncTokenService(consumerJws, consumerClientId);
    expect(result1.limitReached).toBe(false);
    if (result1.limitReached || !result1.tokenGenerated) {
      fail();
    }

    // Second call (get_resource → get_resource allowed)
    const result2 = await callAsyncTokenService(consumerJws, consumerClientId);
    expect(result2.limitReached).toBe(false);
    if (result2.limitReached || !result2.tokenGenerated) {
      fail();
    }

    // Verify interaction still in get_resource state
    const interaction = await readInteraction(
      dynamoDBClient,
      interactionId,
      config.interactionsTable
    );
    expect(interaction!.state).toBe(interactionState.getResource);
  });

  it("should throw interactionIdNotProvided when interactionId is missing", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const consumerClientId = generateId<ClientId>();
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        scope: interactionState.getResource,
      },
    });

    await expect(
      callAsyncTokenService(jws, consumerClientId)
    ).rejects.toThrowError(interactionIdNotProvided(consumerClientId));
  });

  it("should throw interactionNotFound when interaction does not exist", async () => {
    const consumerClientId = generateId<ClientId>();
    const interactionId = generateId<InteractionId>();
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        scope: interactionState.getResource,
        interactionId,
      },
    });

    await expect(
      callAsyncTokenService(jws, consumerClientId)
    ).rejects.toThrowError(interactionNotFound(interactionId));
  });

  it("should throw interactionStateNotAllowed when interaction is in start_interaction state", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId } =
      await setupGetResourceScenario({ skipCallbackInvocation: true });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(
      interactionStateNotAllowed(
        interactionId,
        interactionState.startInteraction,
        interactionState.getResource
      )
    );
  });

  it("should throw tokenGenerationStatesEntryNotFound when consumer is not authorized for interaction's purpose", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      differentConsumerForGetResource: true,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/not found in token-generation-states/);
  });

  it("should throw callbackInvocationTokenIssuedAtMissing when timestamp is missing", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    // Set up with start_interaction only (skip callback_invocation)
    // Then manually update the interaction state to callback_invocation without setting the timestamp
    const { interactionId, consumerClientId } = await setupGetResourceScenario({
      skipCallbackInvocation: true,
    });

    // Manually force interaction to callback_invocation state WITHOUT setting callbackInvocationTokenIssuedAt
    await dynamoDBClient.send(
      new UpdateItemCommand({
        TableName: config.interactionsTable,
        Key: { PK: { S: makeInteractionPK(interactionId) } },
        UpdateExpression: "SET #state = :state, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":state": { S: interactionState.callbackInvocation },
          ":updatedAt": { S: new Date().toISOString() },
        },
      })
    );

    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        scope: interactionState.getResource,
        interactionId,
      },
    });

    await expect(
      callAsyncTokenService(jws, consumerClientId)
    ).rejects.toThrowError(
      callbackInvocationTokenIssuedAtMissing(interactionId)
    );
  });

  it("should throw resourceAvailableTimeExpired when resourceAvailableTime window has elapsed", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { interactionId, consumerClientId } =
      await setupGetResourceScenario();

    // Backdate callbackInvocationTokenIssuedAt by more than resourceAvailableTime (60s)
    await dynamoDBClient.send(
      new UpdateItemCommand({
        TableName: config.interactionsTable,
        Key: { PK: { S: makeInteractionPK(interactionId) } },
        UpdateExpression: "SET callbackInvocationTokenIssuedAt = :ts",
        ExpressionAttributeValues: {
          ":ts": { S: new Date(Date.now() - 61_000).toISOString() },
        },
      })
    );

    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        scope: interactionState.getResource,
        interactionId,
      },
    });

    await expect(
      callAsyncTokenService(jws, consumerClientId)
    ).rejects.toThrowError(/Resource available time expired/);
  });

  it("should verify generated token has correct audience and lifespan from consumer key", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario();
    const result = await callAsyncTokenService(consumerJws, consumerClientId);

    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }

    // The token should have the audience and lifespan from the consumer key in token-generation-states
    expect(result.token.payload.aud).toBeDefined();
    expect(result.token.payload.exp).toBeDefined();
    expect(result.token.payload.sub).toBe(consumerClientId);
  });
});
