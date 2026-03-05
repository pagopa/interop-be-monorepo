import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  DescriptorId,
  EServiceId,
  generateId,
  PurposeId,
  InteractionId,
} from "pagopa-interop-models";
import {
  createInteraction,
  readInteraction,
  readInteractionsByPurposeAndEService,
  updateInteractionState,
} from "../../src/utilities/interactionsUtils.js";
import { dynamoDBClient } from "../integrationUtils.js";

const interactionsTable = "interactions";

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
      purposeId,
      eServiceId,
      descriptorId,
      issuedAt,
    });

    const retrieved = await readInteraction(
      dynamoDBClient,
      interactionId,
      interactionsTable
    );

    expect(retrieved).toEqual(created);
  });

  it("should query interactions by purpose and eService via GSI", async () => {
    const purposeId = generateId<PurposeId>();
    const eServiceId = generateId<EServiceId>();
    const issuedAt = new Date().toISOString();

    const interactionOneId = generateId<InteractionId>();
    const interactionTwoId = generateId<InteractionId>();

    await createInteraction({
      dynamoDBClient,
      interactionsTable,
      interactionId: interactionOneId,
      purposeId,
      eServiceId,
      descriptorId: generateId<DescriptorId>(),
      issuedAt,
    });

    await createInteraction({
      dynamoDBClient,
      interactionsTable,
      interactionId: interactionTwoId,
      purposeId,
      eServiceId,
      descriptorId: generateId<DescriptorId>(),
      issuedAt,
    });

    await createInteraction({
      dynamoDBClient,
      interactionsTable,
      interactionId: generateId<InteractionId>(),
      purposeId: generateId<PurposeId>(),
      eServiceId,
      descriptorId: generateId<DescriptorId>(),
      issuedAt,
    });

    const interactions = await readInteractionsByPurposeAndEService({
      dynamoDBClient,
      interactionsTable,
      purposeId,
      eServiceId,
    });

    expect(interactions).toHaveLength(2);
    expect(interactions.map((i) => i.interactionId)).toEqual(
      expect.arrayContaining([interactionOneId, interactionTwoId])
    );
  });

  it("should update interaction state and token timestamps", async () => {
    const interactionId = generateId<InteractionId>();
    const purposeId = generateId<PurposeId>();
    const eServiceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const startIssuedAt = new Date("2026-01-01T10:00:00.000Z").toISOString();

    await createInteraction({
      dynamoDBClient,
      interactionsTable,
      interactionId,
      purposeId,
      eServiceId,
      descriptorId,
      issuedAt: startIssuedAt,
    });

    const callbackIssuedAt = new Date("2026-01-01T10:01:00.000Z").toISOString();
    await updateInteractionState({
      dynamoDBClient,
      interactionsTable,
      interactionId,
      state: "callback_invocation",
      updatedAt: callbackIssuedAt,
    });

    const confirmedAt = new Date("2026-01-01T10:02:00.000Z").toISOString();
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
    expect(retrieved?.updatedAt).toBe(confirmedAt);
  });
});
