import { dateToSeconds } from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  ClientId,
  DescriptorId,
  EServiceId,
  generateId,
  PurposeId,
  InteractionId,
  TenantId,
} from "pagopa-interop-models";
import {
  createInteraction,
  readInteraction,
  updateInteractionState,
} from "../../src/utilities/interactionsUtils.js";
import { dynamoDBClient } from "../integrationUtils.js";

const interactionsTable = "interactions";
const ttlSeconds = 3600;

describe("interactions utils integration", () => {
  beforeEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient).catch(() => undefined);
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient).catch(() => undefined);
  });

  it("should create and read an interaction from DynamoDB", async () => {
    const interactionId = generateId<InteractionId>();
    const purposeId = generateId<PurposeId>();
    const eServiceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const issuedAt = new Date().toISOString();

    const created = await createInteraction({
      dynamoDBClient,
      interactionsTable,
      interactionId,
      clientId: generateId<ClientId>(),
      purposeId,
      consumerId: generateId<TenantId>(),
      eServiceId,
      descriptorId,
      issuedAt,
      ttlSeconds,
    });

    const retrieved = await readInteraction(
      dynamoDBClient,
      interactionId,
      interactionsTable
    );

    expect(retrieved).toEqual(created);
    expect(created.ttl).toBe(dateToSeconds(new Date(issuedAt)) + ttlSeconds);
  });

  it("should update interaction state and token timestamps", async () => {
    const interactionId = generateId<InteractionId>();
    const purposeId = generateId<PurposeId>();
    const eServiceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const baseTime = Date.now();
    const startIssuedAt = new Date(baseTime).toISOString();

    await createInteraction({
      dynamoDBClient,
      interactionsTable,
      interactionId,
      clientId: generateId<ClientId>(),
      purposeId,
      consumerId: generateId<TenantId>(),
      eServiceId,
      descriptorId,
      issuedAt: startIssuedAt,
      ttlSeconds,
    });

    const callbackIssuedAt = new Date(baseTime + 60_000).toISOString();
    await updateInteractionState({
      dynamoDBClient,
      interactionsTable,
      interactionId,
      state: "callback_invocation",
      updatedAt: callbackIssuedAt,
    });

    const getResourceAt = new Date(baseTime + 90_000).toISOString();
    await updateInteractionState({
      dynamoDBClient,
      interactionsTable,
      interactionId,
      state: "get_resource",
      updatedAt: getResourceAt,
    });

    const confirmedAt = new Date(baseTime + 120_000).toISOString();
    await updateInteractionState({
      dynamoDBClient,
      interactionsTable,
      interactionId,
      state: "confirmation",
      updatedAt: confirmedAt,
    });

    const retrieved = await readInteraction(
      dynamoDBClient,
      interactionId,
      interactionsTable
    );

    expect(retrieved).toBeDefined();
    expect(retrieved?.state).toBe("confirmation");
    expect(retrieved?.startInteractionTokenIssuedAt).toBe(startIssuedAt);
    expect(retrieved?.callbackInvocationTokenIssuedAt).toBe(callbackIssuedAt);
    expect(retrieved?.confirmationTokenIssuedAt).toBe(confirmedAt);
    expect(retrieved?.updatedAt).toBe(confirmedAt);
  });
});
