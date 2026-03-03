import {
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
    const interactionId = "a7a95f6d-8d28-4adf-bcd1-95e420e3ecaa";
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
    const interactionId = "0c7bb447-f33d-4efd-8d2b-295b7abf9cb5";
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
    const i1 = {
      PK: "INTERACTION#4f5f7e67-b322-4eb7-b205-6dc892dfad6f",
      GSIPK_purposeId_eserviceId: `${purposeId}#${eServiceId}`,
      interactionId: "4f5f7e67-b322-4eb7-b205-6dc892dfad6f",
      purposeId,
      eServiceId,
      descriptorId: generateId<DescriptorId>(),
      state: "start_interaction",
      startInteractionTokenIssuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const i2 = {
      ...i1,
      PK: "INTERACTION#21379f30-8be3-4c8f-9fe3-af5b1b885282",
      interactionId: "21379f30-8be3-4c8f-9fe3-af5b1b885282",
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
    const interactionId = "5ce3fec2-9446-485c-a903-5681c4c43cef";
    mockSend.mockResolvedValueOnce({});

    const callbackIssuedAt = new Date().toISOString();
    await updateInteractionState({
      dynamoDBClient: dynamoDBClient as never,
      interactionsTable,
      interactionId,
      state: "callback_invocation",
      updatedAt: callbackIssuedAt,
    });

    const updateCall = mockSend.mock.calls[0][0] as UpdateItemCommand;
    expect(updateCall).toBeInstanceOf(UpdateItemCommand);
    expect(JSON.stringify(updateCall.input)).toContain(
      "callbackInvocationTokenIssuedAt"
    );
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
