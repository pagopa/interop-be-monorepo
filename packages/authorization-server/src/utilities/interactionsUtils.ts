import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  UpdateItemCommand,
  UpdateItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { dateToSeconds } from "pagopa-interop-commons";
import {
  ClientId,
  DescriptorId,
  EServiceId,
  genericInternalError,
  Interaction,
  InteractionId,
  interactionState,
  InteractionState,
  isInteractionStateAllowedForScope,
  makeGSIPKInteractionId,
  makeInteractionPK,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

// Re-exported from pagopa-interop-models so existing call sites keep importing
// it from here; the single source of truth lives in models.
export { isInteractionStateAllowedForScope };

export const createInteraction = async ({
  dynamoDBClient,
  interactionsTable,
  interactionId,
  clientId,
  purposeId,
  consumerId,
  eServiceId,
  descriptorId,
  issuedAt,
  ttlSeconds,
}: {
  dynamoDBClient: DynamoDBClient;
  interactionsTable: string;
  interactionId: InteractionId;
  clientId: ClientId;
  purposeId: PurposeId;
  consumerId: TenantId;
  eServiceId: EServiceId;
  descriptorId: DescriptorId;
  issuedAt: string;
  ttlSeconds: number;
}): Promise<Interaction> => {
  const PK = makeInteractionPK(interactionId);
  const ttl = dateToSeconds(new Date(issuedAt)) + ttlSeconds;
  const interaction: Interaction = {
    PK,
    interactionId,
    clientId,
    purposeId,
    consumerId,
    eServiceId,
    descriptorId,
    state: interactionState.startInteraction,
    startInteractionTokenIssuedAt: issuedAt,
    updatedAt: issuedAt,
    ttl,
  };

  const input: PutItemInput = {
    TableName: interactionsTable,
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: { S: interaction.PK },
      GSIPK_interactionId: { S: makeGSIPKInteractionId(interactionId) },
      interactionId: { S: interaction.interactionId },
      clientId: { S: interaction.clientId },
      purposeId: { S: interaction.purposeId },
      consumerId: { S: interaction.consumerId },
      eServiceId: { S: interaction.eServiceId },
      descriptorId: { S: interaction.descriptorId },
      state: { S: interaction.state },
      startInteractionTokenIssuedAt: {
        S: issuedAt,
      },
      updatedAt: { S: interaction.updatedAt },
      ttl: { N: ttl.toString() },
    },
  };

  await dynamoDBClient.send(new PutItemCommand(input));
  return interaction;
};

export const readInteraction = async (
  dynamoDBClient: DynamoDBClient,
  interactionId: InteractionId,
  interactionsTable: string
): Promise<Interaction | undefined> => {
  const input: GetItemInput = {
    TableName: interactionsTable,
    Key: {
      PK: { S: makeInteractionPK(interactionId) },
    },
    ConsistentRead: true,
  };

  const data: GetItemCommandOutput = await dynamoDBClient.send(
    new GetItemCommand(input)
  );

  if (!data.Item) {
    return undefined;
  }

  const unmarshalled = unmarshall(data.Item);
  const interaction = Interaction.safeParse(unmarshalled);

  if (!interaction.success) {
    throw genericInternalError(
      `Unable to parse interaction entry: result ${JSON.stringify(
        interaction
      )} - data ${JSON.stringify(data)} `
    );
  }

  return interaction.data;
};

export const updateInteractionState = async ({
  dynamoDBClient,
  interactionsTable,
  interactionId,
  state,
  updatedAt,
}: {
  dynamoDBClient: DynamoDBClient;
  interactionsTable: string;
  interactionId: InteractionId;
  state: InteractionState;
  updatedAt: string;
}): Promise<void> => {
  const currentInteraction = await readInteraction(
    dynamoDBClient,
    interactionId,
    interactionsTable
  );

  if (!currentInteraction) {
    throw genericInternalError("Unable to update interaction state");
  }

  if (
    !isInteractionStateAllowedForScope({
      currentState: currentInteraction.state,
      scope: state,
    })
  ) {
    throw genericInternalError("Unable to update interaction state");
  }

  const expressionAttributeValues: NonNullable<
    UpdateItemInput["ExpressionAttributeValues"]
  > = {
    ":state": { S: state },
    ":updatedAt": { S: updatedAt },
  };

  const updateExpressions = ["#state = :state", "updatedAt = :updatedAt"];

  const transitionTimestampField = match(state)
    .with(
      interactionState.startInteraction,
      () => "startInteractionTokenIssuedAt" as const
    )
    .with(
      interactionState.callbackInvocation,
      () => "callbackInvocationTokenIssuedAt" as const
    )
    .with(
      interactionState.confirmation,
      () => "confirmationTokenIssuedAt" as const
    )
    .with(interactionState.getResource, () => undefined)
    .exhaustive();

  if (transitionTimestampField) {
    const placeholder = `:${transitionTimestampField}`;
    expressionAttributeValues[placeholder] = { S: updatedAt };
    updateExpressions.push(`${transitionTimestampField} = ${placeholder}`);
  }

  const input: UpdateItemInput = {
    TableName: interactionsTable,
    Key: {
      PK: {
        S: makeInteractionPK(interactionId),
      },
    },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: {
      "#state": "state",
    },
    ExpressionAttributeValues: expressionAttributeValues,
    ConditionExpression: "attribute_exists(PK)",
  };

  await dynamoDBClient.send(new UpdateItemCommand(input));
};
