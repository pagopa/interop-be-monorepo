import {
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceId,
  generateId,
  PurposeId,
  InteractionId,
} from "pagopa-interop-models";
import {
  createInteraction,
  isInteractionStateAllowedForScope,
  readInteraction,
  readInteractionsByPurposeAndEService,
  updateInteractionState,
} from "../src/utilities/interactionsUtils.js";

const interactionsTable = "interactions";

describe("interactions utils", () => {
  const mockSend = vi.fn();
  const dynamoDBClient = {
    send: mockSend,
  } as unknown as {
    send: (command: unknown) => Promise<unknown>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create and read an interaction", async () => {
    const interactionId = generateId<InteractionId>();
    const purposeId = generateId<PurposeId>();
    const eServiceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const issuedAt = new Date().toISOString();

    mockSend.mockResolvedValueOnce({});

    const created = await createInteraction({
      dynamoDBClient: dynamoDBClient as never,
      interactionsTable,
      interactionId,
      purposeId,
      eServiceId,
      descriptorId,
      issuedAt,
    });

    const putItemCall = mockSend.mock.calls[0][0] as PutItemCommand;
    expect(putItemCall).toBeInstanceOf(PutItemCommand);

    mockSend.mockResolvedValueOnce({
      Item: marshall(created),
    });

    const retrieved = await readInteraction(
      dynamoDBClient as never,
      interactionId,
      interactionsTable
    );

    expect(retrieved).toEqual(created);
  });

  it("should not create duplicated interaction", async () => {
    const interactionId = generateId<InteractionId>();
    const purposeId = generateId<PurposeId>();
    const eServiceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const issuedAt = new Date().toISOString();

    const conditionalError = new Error("Conditional check failed");
    mockSend.mockRejectedValueOnce(conditionalError);

    await expect(
      createInteraction({
        dynamoDBClient: dynamoDBClient as never,
        interactionsTable,
        interactionId,
        purposeId,
        eServiceId,
        descriptorId,
        issuedAt,
      })
    ).rejects.toThrow();
  });

  it("should query interactions by purpose and eService through GSI", async () => {
    const purposeId = generateId<PurposeId>();
    const eServiceId = generateId<EServiceId>();
    const interactionOneId = generateId<InteractionId>();
    const interactionTwoId = generateId<InteractionId>();
    const i1 = {
      PK: `INTERACTION#${interactionOneId}`,
      GSIPK_purposeId_eserviceId: `${purposeId}#${eServiceId}`,
      interactionId: interactionOneId,
      purposeId,
      eServiceId,
      descriptorId: generateId<DescriptorId>(),
      state: "start_interaction",
      startInteractionTokenIssuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const i2 = {
      ...i1,
      PK: `INTERACTION#${interactionTwoId}`,
      interactionId: interactionTwoId,
    };

    mockSend.mockResolvedValueOnce({
      Items: [marshall(i1), marshall(i2)],
    });

    const interactions = await readInteractionsByPurposeAndEService({
      dynamoDBClient: dynamoDBClient as never,
      interactionsTable,
      purposeId,
      eServiceId,
    });

    const queryCall = mockSend.mock.calls[0][0] as QueryCommand;
    expect(queryCall).toBeInstanceOf(QueryCommand);
    expect(interactions).toHaveLength(2);
    interactions.forEach((interaction) => {
      expect(interaction.purposeId).toBe(purposeId);
      expect(interaction.eServiceId).toBe(eServiceId);
    });
  });

  it("should update interaction state and callback timestamp", async () => {
    const interactionId = generateId<InteractionId>();
    const purposeId = generateId<PurposeId>();
    const eServiceId = generateId<EServiceId>();
    const currentInteraction = {
      PK: `INTERACTION#${interactionId}`,
      GSIPK_purposeId_eserviceId: `${purposeId}#${eServiceId}`,
      interactionId,
      purposeId,
      eServiceId,
      descriptorId: generateId<DescriptorId>(),
      state: "start_interaction",
      startInteractionTokenIssuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockSend.mockResolvedValueOnce({ Item: marshall(currentInteraction) });
    mockSend.mockResolvedValueOnce({});

    const callbackIssuedAt = new Date().toISOString();
    await updateInteractionState({
      dynamoDBClient: dynamoDBClient as never,
      interactionsTable,
      interactionId,
      state: "callback_invocation",
      updatedAt: callbackIssuedAt,
    });

    const getItemCall = mockSend.mock.calls[0][0] as GetItemCommand;
    expect(getItemCall).toBeInstanceOf(GetItemCommand);

    const updateCall = mockSend.mock.calls[1][0] as UpdateItemCommand;
    expect(updateCall).toBeInstanceOf(UpdateItemCommand);
    expect(JSON.stringify(updateCall.input)).toContain(
      "callbackInvocationTokenIssuedAt"
    );
    expect(updateCall.input.ConditionExpression).toBe("attribute_exists(PK)");
  });

  it("should throw when state transition is not allowed", async () => {
    const interactionId = generateId<InteractionId>();
    const purposeId = generateId<PurposeId>();
    const eServiceId = generateId<EServiceId>();
    const currentInteraction = {
      PK: `INTERACTION#${interactionId}`,
      GSIPK_purposeId_eserviceId: `${purposeId}#${eServiceId}`,
      interactionId,
      purposeId,
      eServiceId,
      descriptorId: generateId<DescriptorId>(),
      state: "callback_invocation",
      callbackInvocationTokenIssuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockSend.mockResolvedValueOnce({ Item: marshall(currentInteraction) });

    await expect(
      updateInteractionState({
        dynamoDBClient: dynamoDBClient as never,
        interactionsTable,
        interactionId,
        state: "confirmation",
        updatedAt: new Date().toISOString(),
      })
    ).rejects.toThrow("Unable to update interaction state");

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should validate allowed state transitions by scope", () => {
    expect(
      isInteractionStateAllowedForScope({
        currentState: "start_interaction",
        scope: "callback_invocation",
      })
    ).toBe(true);

    expect(
      isInteractionStateAllowedForScope({
        currentState: "callback_invocation",
        scope: "confirmation",
      })
    ).toBe(false);

    expect(
      isInteractionStateAllowedForScope({
        currentState: "confirmation",
        scope: "confirmation",
      })
    ).toBe(true);
  });
});
