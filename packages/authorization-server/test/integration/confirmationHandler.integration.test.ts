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
 * Sets up the full confirmation scenario:
 * 1. Creates a consumer client + start_interaction to get an interaction
 * 2. Creates a producer keychain entry + catalog entry
 * 3. Calls callback_invocation to transition interaction to callback_invocation state
 * 4. Calls get_resource to transition interaction to get_resource state
 * 5. Creates a consumer assertion with scope=confirmation
 */
const setupConfirmationScenario = async (overrides?: {
  consumerCustomClaims?: Record<string, unknown>;
  skipCallbackInvocation?: boolean;
  skipGetResource?: boolean;
  differentConsumerForConfirmation?: boolean;
}): Promise<{
  consumerJws: string;
  consumerClientId: ClientId;
  interactionId: InteractionId;
  eServiceId: EServiceId;
  descriptorId: DescriptorId;
  purposeId: PurposeId;
}> => {
  // Step 1: Create consumer client and start_interaction
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
    () => getMockContext({ correlationId: generateId() }),
    () => {},
    () => {},
    () => {}
  );

  if (startResult.limitReached || !startResult.tokenGenerated) {
    fail("start_interaction should succeed");
  }

  const interactionId = startResult.token.payload
    .interactionId as InteractionId;

  if (!overrides?.skipCallbackInvocation) {
    // Step 2: Create producer keychain entry + catalog entry
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

    const catalogPK = makePlatformStatesEServiceDescriptorPK({
      eserviceId: eServiceId,
      descriptorId,
    });

    const catalogEntry: PlatformStatesCatalogEntry = {
      PK: catalogPK,
      state: itemState.active,
      descriptorAudience: ["https://eservice.example.com"],
      descriptorVoucherLifespan: 3600,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    await writePlatformCatalogEntry(catalogEntry, dynamoDBClient);

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
      () => getMockContext({ correlationId: generateId() }),
      () => {},
      () => {},
      () => {}
    );

    if (callbackResult.limitReached || !callbackResult.tokenGenerated) {
      fail("callback_invocation should succeed");
    }

    if (!overrides?.skipGetResource) {
      // Step 4: Call get_resource to transition interaction to get_resource state
      const threeHourLaterGetResource = new Date();
      threeHourLaterGetResource.setHours(
        threeHourLaterGetResource.getHours() + 3
      );

      const consumerGetResourceJws = await signJWT({
        payload: {
          iss: consumerClientId,
          sub: consumerClientId,
          aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
          exp: dateToSeconds(threeHourLaterGetResource),
          jti: generateId(),
          iat: dateToSeconds(new Date()),
          scope: interactionState.getResource,
          interactionId,
        },
        headers: {
          alg: algorithm.RS256,
          kid: consumerKid,
        },
        keySet: consumerKeySet,
      });

      mockProducer.send.mockImplementationOnce(async () => [
        { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
      ]);

      const getResourceResult = await asyncTokenService.generateAsyncToken(
        {},
        {
          client_id: consumerClientId,
          client_assertion_type:
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion: consumerGetResourceJws,
          grant_type: "client_credentials",
        },
        () => getMockContext({ correlationId: generateId() }),
        () => {},
        () => {},
        () => {}
      );

      if (getResourceResult.limitReached || !getResourceResult.tokenGenerated) {
        fail("get_resource should succeed");
      }
    }
  }

  // Step 5: Create consumer assertion with scope=confirmation
  const confirmationClientId = overrides?.differentConsumerForConfirmation
    ? generateId<ClientId>()
    : consumerClientId;

  const threeHourLater = new Date();
  threeHourLater.setHours(threeHourLater.getHours() + 3);

  const consumerConfirmationJws = await signJWT({
    payload: {
      iss: confirmationClientId,
      sub: confirmationClientId,
      aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
      exp: dateToSeconds(threeHourLater),
      jti: generateId(),
      iat: dateToSeconds(new Date()),
      scope: interactionState.confirmation,
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
    consumerJws: consumerConfirmationJws,
    consumerClientId: confirmationClientId,
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
    () => getMockContext({ correlationId: correlationId ?? generateId() }),
    () => {},
    () => {},
    () => {}
  );

describe("async token service - confirmation", () => {
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

  it("should generate token for confirmation scope", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupConfirmationScenario();
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

  it("should verify token claims contain scope=confirmation and no urlCallback", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId, purposeId } =
      await setupConfirmationScenario();
    const result = await callAsyncTokenService(consumerJws, consumerClientId);

    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }

    expect(result.token.payload.scope).toBe(interactionState.confirmation);
    expect(result.token.payload.interactionId).toBe(interactionId);
    expect(result.token.payload.purposeId).toBe(purposeId);
    expect(result.token.payload.urlCallback).toBeUndefined();
  });

  it("should update interaction state to confirmation", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId } =
      await setupConfirmationScenario();
    await callAsyncTokenService(consumerJws, consumerClientId);

    const interaction = await readInteraction(
      dynamoDBClient,
      interactionId,
      config.interactionsTable
    );

    expect(interaction).toBeDefined();
    expect(interaction!.state).toBe(interactionState.confirmation);
    expect(interaction!.confirmationTokenIssuedAt).toBeDefined();
  });

  it("should allow two calls with confirmation scope (self-loop)", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId } =
      await setupConfirmationScenario();

    // First call
    const result1 = await callAsyncTokenService(consumerJws, consumerClientId);
    expect(result1.limitReached).toBe(false);
    if (result1.limitReached || !result1.tokenGenerated) {
      fail();
    }

    // Second call (confirmation → confirmation allowed)
    const result2 = await callAsyncTokenService(consumerJws, consumerClientId);
    expect(result2.limitReached).toBe(false);
    if (result2.limitReached || !result2.tokenGenerated) {
      fail();
    }

    // Verify interaction still in confirmation state
    const interaction = await readInteraction(
      dynamoDBClient,
      interactionId,
      config.interactionsTable
    );
    expect(interaction!.state).toBe(interactionState.confirmation);
  });

  it("should throw interactionIdNotProvided when interactionId is missing", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const consumerClientId = generateId<ClientId>();
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        scope: interactionState.confirmation,
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
        scope: interactionState.confirmation,
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
      await setupConfirmationScenario({ skipCallbackInvocation: true });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(
      interactionStateNotAllowed(
        interactionId,
        interactionState.startInteraction,
        interactionState.confirmation
      )
    );
  });

  it("should throw interactionStateNotAllowed when interaction is in callback_invocation state", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId } =
      await setupConfirmationScenario({ skipGetResource: true });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(
      interactionStateNotAllowed(
        interactionId,
        interactionState.callbackInvocation,
        interactionState.confirmation
      )
    );
  });

  it("should throw tokenGenerationStatesEntryNotFound when consumer is not authorized for interaction's purpose", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupConfirmationScenario({
      differentConsumerForConfirmation: true,
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
    // Then manually update the interaction state to get_resource without setting callbackInvocationTokenIssuedAt
    const { interactionId, consumerClientId } = await setupConfirmationScenario(
      {
        skipCallbackInvocation: true,
      }
    );

    // Manually force interaction to get_resource state WITHOUT setting callbackInvocationTokenIssuedAt
    await dynamoDBClient.send(
      new UpdateItemCommand({
        TableName: config.interactionsTable,
        Key: { PK: { S: makeInteractionPK(interactionId) } },
        UpdateExpression: "SET #state = :state, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":state": { S: interactionState.getResource },
          ":updatedAt": { S: new Date().toISOString() },
        },
      })
    );

    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        scope: interactionState.confirmation,
        interactionId,
      },
    });

    await expect(
      callAsyncTokenService(jws, consumerClientId)
    ).rejects.toThrowError(
      callbackInvocationTokenIssuedAtMissing(interactionId)
    );
  });

  it("should verify generated token has correct audience and lifespan from consumer key", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupConfirmationScenario();
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
