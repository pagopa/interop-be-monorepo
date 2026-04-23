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

const forceInteractionState = async (
  client: DynamoDBClient,
  interactionId: InteractionId,
  newState: (typeof interactionState)[keyof typeof interactionState],
  options?: { callbackInvocationIssuedAt?: Date; clearIssuedAt?: boolean }
): Promise<void> => {
  const issuedAtIso = (
    options?.callbackInvocationIssuedAt ?? new Date()
  ).toISOString();
  const setExpressions: string[] = [
    "#state = :state",
    "updatedAt = :updatedAt",
  ];
  const attributeValues: Record<string, { S: string }> = {
    ":state": { S: newState },
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
 * Full confirmation scenario: start_interaction, force interaction into
 * `get_resource` (the only valid predecessor) with callback_invocation
 * timestamp set, update catalog entry `confirmation` flag as requested,
 * then issue a fresh consumer JWS for scope=confirmation and align the
 * consumer token-gen-states publicKey.
 */
const setupConfirmationScenario = async (overrides?: {
  consumerCustomClaims?: Record<string, unknown>;
  confirmationEnabled?: boolean;
  skipCatalogEntry?: boolean;
  skipTokenGenStatesEntry?: boolean;
  clearCallbackInvocationIssuedAt?: boolean;
  callbackInvocationIssuedAtOverride?: Date;
  tokenGenStatesAgreementStateOverride?: ItemState;
  tokenGenStatesPurposeStateOverride?: ItemState;
  tokenGenStatesDescriptorStateOverride?: ItemState;
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

  const confirmationEnabled = overrides?.confirmationEnabled ?? true;
  const catalogEntry: PlatformStatesCatalogEntry = {
    PK: catalogPK,
    state: itemState.active,
    descriptorAudience,
    descriptorVoucherLifespan,
    asyncExchange: true,
    asyncExchangeProperties: {
      responseTime: 30,
      resourceAvailableTime: 60,
      confirmation: confirmationEnabled,
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

  // Confirmation can only be reached from get_resource; put interaction there.
  const targetState =
    overrides?.interactionStateOverride ?? interactionState.getResource;
  await forceInteractionState(dynamoDBClient, interactionId, targetState, {
    callbackInvocationIssuedAt: overrides?.callbackInvocationIssuedAtOverride,
    clearIssuedAt: overrides?.clearCallbackInvocationIssuedAt,
  });

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

  const { jws: confirmationJws, publicKeyEncodedPem: confirmationPublicKey } =
    await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        purposeId: purpose.id,
        scope: interactionState.confirmation,
        interactionId,
        ...overrides?.consumerCustomClaims,
      },
    });

  if (!overrides?.skipTokenGenStatesEntry) {
    await overrideTokenGenStatesFields(tokenClientKidPurposePK, {
      publicKey: { S: confirmationPublicKey },
    });
  }

  return {
    consumerJws: confirmationJws,
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

  it("should generate token for confirmation scope from get_resource", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupConfirmationScenario();
    const result = await callAsyncTokenService(consumerJws, consumerClientId);

    expect(result.limitReached).toBe(false);
    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }
    expect(result.token.serialized).toBeDefined();
    expect(result.isDPoP).toBe(false);
  });

  it("should allow confirmation self-loop", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId, interactionId } =
      await setupConfirmationScenario();

    const r1 = await callAsyncTokenService(consumerJws, consumerClientId);
    if (r1.limitReached || !r1.tokenGenerated) {
      fail();
    }
    const r2 = await callAsyncTokenService(consumerJws, consumerClientId);
    if (r2.limitReached || !r2.tokenGenerated) {
      fail();
    }

    const interaction = await readInteraction(
      dynamoDBClient,
      interactionId,
      config.interactionsTable
    );
    expect(interaction!.state).toBe(interactionState.confirmation);
    expect(interaction!.confirmationTokenIssuedAt).toBeDefined();
  });

  it("should generate a token with all expected claims (scope=confirmation)", async () => {
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
    } = await setupConfirmationScenario();

    const beforeMs = Date.now();
    const result = await callAsyncTokenService(consumerJws, consumerClientId);
    const afterMs = Date.now();

    if (result.limitReached || !result.tokenGenerated) {
      fail();
    }

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
      scope: interactionState.confirmation,
    });

    const { iat, nbf, exp } = result.token.payload;
    expect(iat).toBeGreaterThanOrEqual(Math.floor(beforeMs / 1000));
    expect(iat).toBeLessThanOrEqual(Math.ceil(afterMs / 1000));
    expect(nbf).toBe(iat);
    expect(exp).toBe(iat + descriptorVoucherLifespan);
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
    expect(interaction!.state).toBe(interactionState.confirmation);
    expect(interaction!.confirmationTokenIssuedAt).toBeDefined();
  });

  it("should throw asyncExchangeConfirmationNotEnabled when confirmation flag is false", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupConfirmationScenario({
      confirmationEnabled: false,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(
      /Async exchange confirmation is not enabled for the eService/
    );
  });

  it("should throw interactionIdNotProvided when interactionId claim is missing", async () => {
    const consumerClientId = generateId<ClientId>();
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { sub: consumerClientId },
      customClaims: {
        purposeId: generateId<PurposeId>(),
        scope: interactionState.confirmation,
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
        purposeId: generateId<PurposeId>(),
        scope: interactionState.confirmation,
        interactionId,
      },
    });

    await expect(
      callAsyncTokenService(jws, consumerClientId)
    ).rejects.toThrowError(interactionNotFound(interactionId));
  });

  it("should throw interactionStateNotAllowed when interaction is still in callback_invocation", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupConfirmationScenario({
      interactionStateOverride: interactionState.callbackInvocation,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(
      /Interaction .* in state callback_invocation does not allow scope confirmation/
    );
  });

  it("should throw callbackInvocationTokenIssuedAtMissing when the timestamp is absent", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupConfirmationScenario({
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

    const { consumerJws, consumerClientId } = await setupConfirmationScenario({
      callbackInvocationIssuedAtOverride: new Date(Date.now() - 61_000),
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/Resource available time expired/);
  });

  it("should throw platformStateValidationFailed when purpose state is INACTIVE", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupConfirmationScenario({
      tokenGenStatesPurposeStateOverride: itemState.inactive,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/Purpose state is: INACTIVE/);
  });

  it("should throw catalogEntryNotFound when catalog entry is absent", async () => {
    mockProducer.send.mockImplementation(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);

    const { consumerJws, consumerClientId } = await setupConfirmationScenario({
      skipCatalogEntry: true,
    });

    await expect(
      callAsyncTokenService(consumerJws, consumerClientId)
    ).rejects.toThrowError(/catalog entry not found/i);
  });
});
