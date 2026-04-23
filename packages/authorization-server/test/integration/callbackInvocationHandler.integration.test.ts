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
} from "pagopa-interop-commons-test";
import {
  ClientId,
  CorrelationId,
  DescriptorId,
  EServiceId,
  generateId,
  InteractionId,
  interactionState,
  ItemState,
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
  TenantId,
  TokenGenerationStatesConsumerClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { config } from "../../src/config/config.js";
import {
  entityNumberNotProvided,
  interactionIdNotProvided,
  interactionNotFound,
  invalidEntityNumber,
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
    producerId: TenantId;
    kid: string;
    eServiceId: EServiceId;
    version: number;
    updatedAt: string;
  },
  client: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    TableName: config.producerKeychainPlatformStatesTable,
    Item: {
      PK: { S: entry.PK },
      publicKey: { S: entry.publicKey },
      producerKeychainId: { S: entry.producerKeychainId },
      producerId: { S: entry.producerId },
      kid: { S: entry.kid },
      eServiceId: { S: entry.eServiceId },
      version: { N: entry.version.toString() },
      updatedAt: { S: entry.updatedAt },
    },
  };
  await client.send(new PutItemCommand(input));
};

/**
 * Sets up the full callback_invocation scenario:
 * 1. Creates a consumer client + start_interaction to get an interaction
 * 2. Creates a producer keychain entry in producer-keychain-platform-states
 * 3. Creates a platform-states catalog entry
 */
const setupCallbackScenario = async (overrides?: {
  producerCustomClaims?: Record<string, unknown>;
  skipProducerKey?: boolean;
  skipCatalogEntry?: boolean;
  tokenGenStatesAgreementStateOverride?: ItemState;
  tokenGenStatesPurposeStateOverride?: ItemState;
  tokenGenStatesDescriptorStateOverride?: ItemState;
}): Promise<{
  producerJws: string;
  producerClientId: ClientId;
  interactionId: InteractionId;
  eServiceId: EServiceId;
  descriptorId: DescriptorId;
  purposeId: PurposeId;
  producerKeychainId: ProducerKeychainId;
}> => {
  // Step 1: Create consumer client and start_interaction to create an interaction
  const purpose: Purpose = {
    ...getMockPurpose(),
    versions: [getMockPurposeVersion(purposeVersionState.active)],
  };
  const consumerClientId = generateId<ClientId>();
  const eServiceId = generateId<EServiceId>();
  const descriptorId = generateId<DescriptorId>();

  const {
    jws: consumerJws,
    clientAssertion: consumerAssertion,
    publicKeyEncodedPem: consumerPublicKey,
  } = await getMockClientAssertion({
    standardClaimsOverride: { sub: consumerClientId },
    customClaims: {
      purposeId: purpose.id,
      urlCallback: "https://callback.example.com",
      scope: interactionState.startInteraction,
    },
  });

  const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK({
    clientId: consumerClientId,
    kid: consumerAssertion.header.kid!,
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
      kid: consumerAssertion.header.kid!,
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

  // Override token-generation-states state fields BEFORE callback_invocation
  // (start_interaction needs them ACTIVE; callback_invocation reads them via GSI Purpose)
  const tokenGenStatesStateOverrides = {
    ...(overrides?.tokenGenStatesAgreementStateOverride && {
      agreementState: { S: overrides.tokenGenStatesAgreementStateOverride },
    }),
    ...(overrides?.tokenGenStatesPurposeStateOverride && {
      purposeState: { S: overrides.tokenGenStatesPurposeStateOverride },
    }),
    ...(overrides?.tokenGenStatesDescriptorStateOverride && {
      descriptorState: { S: overrides.tokenGenStatesDescriptorStateOverride },
    }),
  };

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
      client_assertion: consumerJws,
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

  // After start_interaction, modify catalog entry for callback_invocation test scenarios
  if (overrides?.skipCatalogEntry) {
    await dynamoDBClient.send(
      new DeleteItemCommand({
        TableName: config.platformStatesTable,
        Key: { PK: { S: catalogPK } },
      })
    );
  }

  // Apply token-generation-states state overrides AFTER start_interaction
  // (start_interaction requires them ACTIVE; callback_invocation may need them inactive)
  if (Object.keys(tokenGenStatesStateOverrides).length > 0) {
    const setExpressions: string[] = [];
    const attributeValues: Record<string, { S: string }> = {};
    if (tokenGenStatesStateOverrides.agreementState) {
      setExpressions.push("agreementState = :as");
      attributeValues[":as"] = tokenGenStatesStateOverrides.agreementState;
    }
    if (tokenGenStatesStateOverrides.purposeState) {
      setExpressions.push("purposeState = :ps");
      attributeValues[":ps"] = tokenGenStatesStateOverrides.purposeState;
    }
    if (tokenGenStatesStateOverrides.descriptorState) {
      setExpressions.push("descriptorState = :ds");
      attributeValues[":ds"] = tokenGenStatesStateOverrides.descriptorState;
    }
    await dynamoDBClient.send(
      new UpdateItemCommand({
        TableName: config.tokenGenerationStatesTable,
        Key: { PK: { S: tokenClientKidPurposePK } },
        UpdateExpression: `SET ${setExpressions.join(", ")}`,
        ExpressionAttributeValues: attributeValues,
      })
    );
  }

  // Step 2: Create a producer keychain entry
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
      ...overrides?.producerCustomClaims,
    },
  });

  if (!overrides?.skipProducerKey) {
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
        producerId: generateId<TenantId>(),
        kid: producerAssertion.header.kid!,
        eServiceId,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      dynamoDBClient
    );
  }

  return {
    producerJws,
    producerClientId: unsafeBrandId<ClientId>(producerKeychainId),
    interactionId,
    eServiceId,
    descriptorId,
    purposeId: purpose.id,
    producerKeychainId: unsafeBrandId<ProducerKeychainId>(producerKeychainId),
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

describe("async token service - callback_invocation", () => {
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

  it("should generate token for callback_invocation scope with entityNumber = 1", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId } = await setupCallbackScenario();
    const result = await callAsyncTokenService(producerJws, producerClientId);

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

  it("should generate token for callback_invocation with entityNumber > 1", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId } = await setupCallbackScenario({
      producerCustomClaims: { entityNumber: 5 },
    });
    const result = await callAsyncTokenService(producerJws, producerClientId);

    expect(result.limitReached).toBe(false);
    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }
    expect(result.token.serialized).toBeDefined();
  });

  it("should verify token claims contain scope=callback_invocation", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId, interactionId } =
      await setupCallbackScenario();
    const result = await callAsyncTokenService(producerJws, producerClientId);

    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }

    const payload = result.token.payload as {
      scope: string;
      interactionId: string;
    };
    expect(payload.scope).toBe(interactionState.callbackInvocation);
    expect(payload.interactionId).toBe(interactionId);
  });

  it("should update interaction state to callback_invocation", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId, interactionId } =
      await setupCallbackScenario();
    await callAsyncTokenService(producerJws, producerClientId);

    const interaction = await readInteraction(
      dynamoDBClient,
      interactionId,
      config.interactionsTable
    );

    expect(interaction).toBeDefined();
    expect(interaction!.state).toBe(interactionState.callbackInvocation);
    expect(interaction!.callbackInvocationTokenIssuedAt).toBeDefined();
  });

  it("should allow two calls with callback_invocation scope (self-loop)", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId, interactionId } =
      await setupCallbackScenario();

    // First call
    const result1 = await callAsyncTokenService(producerJws, producerClientId);
    expect(result1.limitReached).toBe(false);
    if (result1.limitReached || !result1.tokenGenerated) {
      fail();
    }

    // Second call with same JWS (callback_invocation → callback_invocation allowed)
    const result2 = await callAsyncTokenService(producerJws, producerClientId);
    expect(result2.limitReached).toBe(false);
    if (result2.limitReached || !result2.tokenGenerated) {
      fail();
    }

    // Verify interaction still in callback_invocation state
    const interaction = await readInteraction(
      dynamoDBClient,
      interactionId,
      config.interactionsTable
    );
    expect(interaction!.state).toBe(interactionState.callbackInvocation);
  });

  it("should throw interactionIdNotProvided when interactionId is missing", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const producerKeychainId = generateId<ProducerKeychainId>();
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: producerKeychainId },
      customClaims: {
        scope: interactionState.callbackInvocation,
        entityNumber: 1,
      },
    });

    await expect(
      callAsyncTokenService(jws, unsafeBrandId<ClientId>(producerKeychainId))
    ).rejects.toThrowError(interactionIdNotProvided(producerKeychainId));
  });

  it("should throw entityNumberNotProvided when entityNumber is missing", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const producerKeychainId = generateId<ProducerKeychainId>();
    const interactionId = generateId<InteractionId>();
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: producerKeychainId },
      customClaims: {
        scope: interactionState.callbackInvocation,
        interactionId,
      },
    });

    await expect(
      callAsyncTokenService(jws, unsafeBrandId<ClientId>(producerKeychainId))
    ).rejects.toThrowError(entityNumberNotProvided(producerKeychainId));
  });

  it("should throw invalidEntityNumber when entityNumber is 0", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const producerKeychainId = generateId<ProducerKeychainId>();
    const interactionId = generateId<InteractionId>();
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: producerKeychainId },
      customClaims: {
        scope: interactionState.callbackInvocation,
        interactionId,
        entityNumber: 0,
      },
    });

    await expect(
      callAsyncTokenService(jws, unsafeBrandId<ClientId>(producerKeychainId))
    ).rejects.toThrowError(invalidEntityNumber(producerKeychainId, 0));
  });

  it("should throw interactionNotFound when interaction does not exist", async () => {
    const producerKeychainId = generateId<ProducerKeychainId>();
    const interactionId = generateId<InteractionId>();
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: producerKeychainId },
      customClaims: {
        scope: interactionState.callbackInvocation,
        interactionId,
        entityNumber: 1,
      },
    });

    await expect(
      callAsyncTokenService(jws, unsafeBrandId<ClientId>(producerKeychainId))
    ).rejects.toThrowError(interactionNotFound(interactionId));
  });

  it("should throw producerKeychainEntryNotFound when producer key does not exist", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId } = await setupCallbackScenario({
      skipProducerKey: true,
    });

    await expect(
      callAsyncTokenService(producerJws, producerClientId)
    ).rejects.toThrowError(/Producer keychain entry not found/);
  });

  it("should throw catalogEntryNotFound when catalog entry does not exist", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId } = await setupCallbackScenario({
      skipCatalogEntry: true,
    });

    await expect(
      callAsyncTokenService(producerJws, producerClientId)
    ).rejects.toThrowError(/catalog entry not found/);
  });

  it("should throw asyncExchangeResponseTimeExceeded when response time is exceeded", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId, interactionId } =
      await setupCallbackScenario();

    // Set startInteractionTokenIssuedAt to 31 seconds ago, exceeding the 30s responseTime
    const pastTime = new Date(Date.now() - 31_000).toISOString();
    await dynamoDBClient.send(
      new UpdateItemCommand({
        TableName: config.interactionsTable,
        Key: { PK: { S: makeInteractionPK(interactionId) } },
        UpdateExpression: "SET startInteractionTokenIssuedAt = :t",
        ExpressionAttributeValues: { ":t": { S: pastTime } },
      })
    );

    await expect(
      callAsyncTokenService(producerJws, producerClientId)
    ).rejects.toThrowError(/Async exchange response time exceeded/);
  });

  it("should throw entityNumberExceedsMaxResultSet when entityNumber exceeds maxResultSet", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId } = await setupCallbackScenario({
      producerCustomClaims: { entityNumber: 101 },
    });

    await expect(
      callAsyncTokenService(producerJws, producerClientId)
    ).rejects.toThrowError(/entityNumber 101 exceeds maxResultSet 100/);
  });

  it("should throw platformStateValidationFailed when agreement state is INACTIVE", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId } = await setupCallbackScenario({
      tokenGenStatesAgreementStateOverride: itemState.inactive,
    });

    await expect(
      callAsyncTokenService(producerJws, producerClientId)
    ).rejects.toThrowError(/Agreement state is: INACTIVE/);
  });

  it("should throw platformStateValidationFailed when purpose state is INACTIVE", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId } = await setupCallbackScenario({
      tokenGenStatesPurposeStateOverride: itemState.inactive,
    });

    await expect(
      callAsyncTokenService(producerJws, producerClientId)
    ).rejects.toThrowError(/Purpose state is: INACTIVE/);
  });

  it("should throw platformStateValidationFailed when descriptor state is INACTIVE", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId } = await setupCallbackScenario({
      tokenGenStatesDescriptorStateOverride: itemState.inactive,
    });

    await expect(
      callAsyncTokenService(producerJws, producerClientId)
    ).rejects.toThrowError(/E-Service state is: INACTIVE/);
  });

  it("should aggregate multiple inactive state errors in platformStateValidationFailed", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { producerJws, producerClientId } = await setupCallbackScenario({
      tokenGenStatesAgreementStateOverride: itemState.inactive,
      tokenGenStatesPurposeStateOverride: itemState.inactive,
    });

    await expect(
      callAsyncTokenService(producerJws, producerClientId)
    ).rejects.toThrowError(
      /Agreement state is: INACTIVE.*Purpose state is: INACTIVE/
    );
  });
});
