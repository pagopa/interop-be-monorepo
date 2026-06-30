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
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesCatalogEntry,
  Purpose,
  PurposeId,
  purposeVersionState,
  TenantId,
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
import {
  DeleteItemCommand,
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { config } from "../../src/config/config.js";
import { interactionIdNotProvided } from "pagopa-interop-client-assertion-validation";
import { interactionNotFound } from "../../src/model/domain/errors.js";
import { readInteraction } from "../../src/utilities/interactionsUtils.js";
import {
  asyncTokenService,
  configTokenGenerationStates,
  dynamoDBClient,
} from "../integrationUtils.js";
import { mockKMSClient, mockProducer } from "../mockUtils.js";

/**
 * Forces an interaction into `callback_invocation` state with a given
 * `callbackInvocationTokenIssuedAt` so get_resource sees a valid precondition.
 */
const markInteractionAsCallbackInvocation = async (
  client: DynamoDBClient,
  interactionId: InteractionId,
  options?: { issuedAt?: Date; clearIssuedAt?: boolean }
): Promise<void> => {
  const issuedAtIso = (options?.issuedAt ?? new Date()).toISOString();
  const setExpressions: string[] = [
    "#state = :state",
    "updatedAt = :updatedAt",
  ];
  const attributeValues: Record<string, { S: string }> = {
    ":state": { S: interactionState.callbackInvocation },
    ":updatedAt": { S: issuedAtIso },
  };
  if (options?.clearIssuedAt !== true) {
    setExpressions.push(
      "callbackInvocationTokenIssuedAt = :callbackInvocationTokenIssuedAt"
    );
    attributeValues[":callbackInvocationTokenIssuedAt"] = { S: issuedAtIso };
  }

  await client.send(
    new UpdateItemCommand({
      TableName: config.interactionsTable,
      Key: { PK: { S: makeInteractionPK(interactionId) } },
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeNames: { "#state": "state" },
      ExpressionAttributeValues: attributeValues,
    })
  );
};

const overrideTokenGenStatesFields = async (
  pk: string,
  overrides: Record<string, { S: string }>
): Promise<void> => {
  const keys = Object.keys(overrides);
  if (keys.length === 0) {
    return;
  }
  const setExpressions = keys.map((k) => `${k} = :${k}`);
  const attributeValues: Record<string, { S: string }> = {};
  for (const k of keys) {
    attributeValues[`:${k}`] = overrides[k];
  }
  await dynamoDBClient.send(
    new UpdateItemCommand({
      TableName: config.tokenGenerationStatesTable,
      Key: { PK: { S: pk } },
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeValues: attributeValues,
    })
  );
};

/**
 * Full get_resource scenario:
 * 1. Creates a consumer token-generation-states entry with asyncExchange=true.
 * 2. Creates a platform-states catalog entry.
 * 3. Calls start_interaction to materialize an Interaction in the DB.
 * 4. Forces the Interaction into `callback_invocation` state (bypassing the
 *    producer-side callback_invocation call, which is covered by its own test file).
 * 5. Builds a fresh consumer JWS for scope=get_resource and aligns the
 *    token-generation-states publicKey with the new keypair so signature
 *    verification passes.
 */
const setupGetResourceScenario = async (overrides?: {
  consumerCustomClaims?: Record<string, unknown>;
  skipCatalogEntry?: boolean;
  skipTokenGenStatesEntry?: boolean;
  clearCallbackInvocationIssuedAt?: boolean;
  callbackInvocationIssuedAtOverride?: Date;
  tokenGenStatesAgreementStateOverride?: ItemState;
  tokenGenStatesPurposeStateOverride?: ItemState;
  tokenGenStatesDescriptorStateOverride?: ItemState;
  catalogEntryStateOverride?: ItemState;
  interactionStateOverride?: (typeof interactionState)[keyof typeof interactionState];
}): Promise<{
  consumerJws: string;
  consumerClientId: ClientId;
  interactionId: InteractionId;
  eServiceId: EServiceId;
  descriptorId: DescriptorId;
  purposeId: PurposeId;
  consumerId: TenantId;
  producerId: TenantId;
  descriptorAudience: string[];
  descriptorVoucherLifespan: number;
}> => {
  const purpose: Purpose = {
    ...getMockPurpose(),
    versions: [getMockPurposeVersion(purposeVersionState.active)],
  };
  const consumerClientId = generateId<ClientId>();
  const eServiceId = generateId<EServiceId>();
  const descriptorId = generateId<DescriptorId>();

  // Step 1: first assertion bootstraps the consumer keypair (used by start_interaction).
  const {
    jws: startInteractionJws,
    clientAssertion: startAssertion,
    publicKeyEncodedPem: startPublicKey,
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
    kid: startAssertion.header.kid!,
    purposeId: purpose.id,
  });

  const descriptorAudience = ["https://eservice.example.com"];
  const descriptorVoucherLifespan = 3600;

  const tokenClientPurposeEntry: TokenGenerationStatesConsumerClient = {
    ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
    consumerId: purpose.consumerId,
    GSIPK_purposeId: purpose.id,
    purposeState: itemState.active,
    purposeVersionId: purpose.versions[0].id,
    agreementState: itemState.active,
    descriptorState: itemState.active,
    descriptorAudience,
    descriptorVoucherLifespan,
    asyncExchange: true,
    GSIPK_clientId: consumerClientId,
    GSIPK_clientId_kid: makeGSIPKClientIdKid({
      clientId: consumerClientId,
      kid: startAssertion.header.kid!,
    }),
    GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
      eserviceId: eServiceId,
      descriptorId,
    }),
    publicKey: startPublicKey,
  };

  await writeTokenGenStatesConsumerClient(
    tokenClientPurposeEntry,
    dynamoDBClient
  );

  const catalogPK = makePlatformStatesEServiceDescriptorPK({
    eserviceId: eServiceId,
    descriptorId,
  });
  const catalogEntry: PlatformStatesCatalogEntry = {
    PK: catalogPK,
    state: itemState.active,
    descriptorAudience,
    descriptorVoucherLifespan,
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

  const startResult = await asyncTokenService.generateAsyncToken(
    {},
    {
      client_id: consumerClientId,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: startInteractionJws,
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

  // Step 2: force interaction into the required state.
  const targetState =
    overrides?.interactionStateOverride ?? interactionState.callbackInvocation;

  if (targetState === interactionState.callbackInvocation) {
    await markInteractionAsCallbackInvocation(dynamoDBClient, interactionId, {
      issuedAt: overrides?.callbackInvocationIssuedAtOverride,
      clearIssuedAt: overrides?.clearCallbackInvocationIssuedAt,
    });
  } else if (targetState !== interactionState.startInteraction) {
    await markInteractionAsCallbackInvocation(dynamoDBClient, interactionId, {
      issuedAt: overrides?.callbackInvocationIssuedAtOverride,
      clearIssuedAt: overrides?.clearCallbackInvocationIssuedAt,
    });
    await dynamoDBClient.send(
      new UpdateItemCommand({
        TableName: config.interactionsTable,
        Key: { PK: { S: makeInteractionPK(interactionId) } },
        UpdateExpression: "SET #state = :state",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: { ":state": { S: targetState } },
      })
    );
  }

  // Step 3: optional catalog / token-gen-states removal overrides.
  if (overrides?.skipCatalogEntry) {
    await dynamoDBClient.send(
      new DeleteItemCommand({
        TableName: config.platformStatesTable,
        Key: { PK: { S: catalogPK } },
      })
    );
  }
  if (overrides?.skipTokenGenStatesEntry) {
    await dynamoDBClient.send(
      new DeleteItemCommand({
        TableName: config.tokenGenerationStatesTable,
        Key: { PK: { S: tokenClientKidPurposePK } },
      })
    );
  }

  // Step 4: state overrides on the consumer token-gen-states entry.
  const stateOverrides: Record<string, { S: string }> = {};
  if (overrides?.tokenGenStatesAgreementStateOverride) {
    stateOverrides.agreementState = {
      S: overrides.tokenGenStatesAgreementStateOverride,
    };
  }
  if (overrides?.tokenGenStatesPurposeStateOverride) {
    stateOverrides.purposeState = {
      S: overrides.tokenGenStatesPurposeStateOverride,
    };
  }
  if (overrides?.tokenGenStatesDescriptorStateOverride) {
    stateOverrides.descriptorState = {
      S: overrides.tokenGenStatesDescriptorStateOverride,
    };
  }
  await overrideTokenGenStatesFields(tokenClientKidPurposePK, stateOverrides);

  // The catalog entry state must be overridden after start_interaction —
  // setting it before would make start_interaction itself fail on the same
  // pinned-descriptor check.
  if (overrides?.catalogEntryStateOverride) {
    await dynamoDBClient.send(
      new UpdateItemCommand({
        TableName: config.platformStatesTable,
        Key: { PK: { S: catalogPK } },
        UpdateExpression: "SET #state = :state",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":state": { S: overrides.catalogEntryStateOverride },
        },
      })
    );
  }

  // Step 5: fresh assertion for get_resource (new keypair); align token-gen-states publicKey.
  //         get_resource does not require purposeId in the claims; the handler
  //         derives the purpose from the interaction.
  const { jws: getResourceJws, publicKeyEncodedPem: getResourcePublicKey } =
    await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        scope: interactionState.getResource,
        interactionId,
        ...overrides?.consumerCustomClaims,
      },
    });

  if (!overrides?.skipTokenGenStatesEntry) {
    await overrideTokenGenStatesFields(tokenClientKidPurposePK, {
      publicKey: { S: getResourcePublicKey },
    });
  }

  return {
    consumerJws: getResourceJws,
    consumerClientId,
    interactionId,
    eServiceId,
    descriptorId,
    purposeId: purpose.id,
    consumerId: purpose.consumerId,
    producerId: tokenClientPurposeEntry.producerId!,
    descriptorAudience: catalogEntry.descriptorAudience,
    descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
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

  it("should generate token for get_resource scope (from callback_invocation)", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario();
    const result = await callAsyncTokenService(consumerJws, consumerClientId);

    expect(result.limitReached).toBe(false);
    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }
    expect(result.token.serialized).toBeDefined();
    expect(result.isDPoP).toBe(false);
  });

  it("should allow get_resource self-loop", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId } =
      await setupGetResourceScenario();

    const r1 = await callAsyncTokenService(consumerJws, consumerClientId);
    expect(r1.limitReached).toBe(false);
    if (r1.limitReached || !r1.tokenGenerated) {
      fail();
    }

    const r2 = await callAsyncTokenService(consumerJws, consumerClientId);
    expect(r2.limitReached).toBe(false);
    if (r2.limitReached || !r2.tokenGenerated) {
      fail();
    }

    const interaction = await readInteraction(
      dynamoDBClient,
      interactionId,
      config.interactionsTable
    );
    expect(interaction!.state).toBe(interactionState.getResource);
  });

  it("should generate a token with all expected header and payload claims", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const {
      consumerJws,
      consumerClientId,
      interactionId,
      eServiceId,
      descriptorId,
      purposeId,
      consumerId,
      producerId,
      descriptorAudience,
      descriptorVoucherLifespan,
    } = await setupGetResourceScenario();

    const beforeMs = Date.now();
    const result = await callAsyncTokenService(consumerJws, consumerClientId);
    const afterMs = Date.now();

    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }

    expect(result.token.header).toEqual({
      alg: "RS256",
      use: "sig",
      typ: "at+jwt",
      kid: config.generatedInteropTokenKid,
    });

    expect(result.token.payload).toEqual({
      jti: expect.any(String),
      iss: config.generatedInteropTokenIssuer,
      aud: descriptorAudience,
      client_id: consumerClientId,
      sub: consumerClientId,
      iat: expect.any(Number),
      nbf: expect.any(Number),
      exp: expect.any(Number),
      purposeId,
      producerId,
      consumerId,
      eserviceId: eServiceId,
      descriptorId,
      interactionId,
      scope: interactionState.getResource,
    });

    const { iat, nbf, exp } = result.token.payload;
    expect(iat).toBeGreaterThanOrEqual(Math.floor(beforeMs / 1000));
    expect(iat).toBeLessThanOrEqual(Math.ceil(afterMs / 1000));
    expect(nbf).toBe(iat);
    expect(exp).toBe(iat + descriptorVoucherLifespan);
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
    expect(interaction!.state).toBe(interactionState.getResource);
    expect(interaction!.callbackInvocationTokenIssuedAt).toBeDefined();
  });

  it("should throw interactionIdNotProvided when interactionId claim is missing", async () => {
    const consumerClientId = generateId<ClientId>();
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        scope: interactionState.getResource,
      },
    });

    await expect(
      callAsyncTokenService(jws, consumerClientId)
    ).rejects.toThrowError(
      new RegExp(interactionIdNotProvided(consumerClientId).detail)
    );
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

  it("should throw interactionClientMismatch when clientId on the interaction differs", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId } =
      await setupGetResourceScenario();

    // Rewrite the interaction's clientId to simulate a sibling client on the
    // same tenant trying to pick up a token for an exchange it did not start.
    await dynamoDBClient.send(
      new UpdateItemCommand({
        TableName: config.interactionsTable,
        Key: { PK: { S: makeInteractionPK(interactionId) } },
        UpdateExpression: "SET clientId = :c",
        ExpressionAttributeValues: {
          ":c": { S: generateId<ClientId>() },
        },
      })
    );

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/was not started by the requesting client/);
  });

  it("should throw interactionStateNotAllowed when interaction is still in start_interaction", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      interactionStateOverride: interactionState.startInteraction,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(
      /Interaction .* in state start_interaction does not allow scope get_resource/
    );
  });

  it("should throw callbackInvocationTokenIssuedAtMissing when the timestamp is absent", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      clearCallbackInvocationIssuedAt: true,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/missing callbackInvocationTokenIssuedAt/);
  });

  it("should throw resourceAvailableTimeExpired when the window elapsed", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      callbackInvocationIssuedAtOverride: new Date(Date.now() - 61_000),
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/Resource available time expired/);
  });

  it("should throw platformStateValidationFailed when agreement state is INACTIVE", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      tokenGenStatesAgreementStateOverride: itemState.inactive,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/Agreement state is: INACTIVE/);
  });

  it("should throw platformStateValidationFailed when purpose state is INACTIVE", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      tokenGenStatesPurposeStateOverride: itemState.inactive,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/Purpose state is: INACTIVE/);
  });

  it("should throw platformStateValidationFailed when descriptor state is INACTIVE", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      tokenGenStatesDescriptorStateOverride: itemState.inactive,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/E-Service state is: INACTIVE/);
  });

  it("should throw platformStateValidationFailed when pinned descriptor catalog state is INACTIVE", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      catalogEntryStateOverride: itemState.inactive,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(
      /E-Service state for pinned descriptor .* is: INACTIVE/
    );
  });

  it("should throw catalogEntryNotFound when catalog entry is absent", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      skipCatalogEntry: true,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/catalog entry not found/i);
  });

  it("should throw tokenGenerationStatesEntryNotFound when consumer entry is absent", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupGetResourceScenario({
      skipTokenGenStatesEntry: true,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/not found in token-generation-states/);
  });
});
