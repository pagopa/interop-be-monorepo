import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  QueryCommand,
  QueryCommandOutput,
  QueryInput,
  UpdateItemCommand,
  UpdateItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  DescriptorId,
  EServiceId,
  genericInternalError,
  Interaction,
  InteractionId,
  interactionState,
  InteractionState,
  makeGSIPKPurposeIdEServiceId,
  makeInteractionPK,
  PurposeId,
} from "pagopa-interop-models";

const interactionStateAllowedByScope: Record<
  InteractionState,
  InteractionState[]
> = {
  [interactionState.startInteraction]: [],
  [interactionState.callbackInvocation]: [
    interactionState.startInteraction,
    interactionState.callbackInvocation,
  ],
  [interactionState.getResource]: [
    interactionState.callbackInvocation,
    interactionState.getResource,
  ],
  [interactionState.confirmation]: [
    interactionState.getResource,
    interactionState.confirmation,
  ],
};

export const createInteraction = async ({
  dynamoDBClient,
  interactionsTable,
  interactionId,
  purposeId,
  eServiceId,
  descriptorId,
  issuedAt,
}: {
  dynamoDBClient: DynamoDBClient;
  interactionsTable: string;
  interactionId: InteractionId;
  purposeId: PurposeId;
  eServiceId: EServiceId;
  descriptorId: DescriptorId;
  issuedAt: string;
}): Promise<Interaction> => {
  const PK = makeInteractionPK(interactionId);
  const interaction: Interaction = {
    PK,
    GSIPK_purposeId_eserviceId: makeGSIPKPurposeIdEServiceId({
      purposeId,
      eServiceId,
    }),
    interactionId,
    purposeId,
    eServiceId,
    descriptorId,
    state: interactionState.startInteraction,
    startInteractionTokenIssuedAt: issuedAt,
    updatedAt: issuedAt,
  };

  const input: PutItemInput = {
    TableName: interactionsTable,
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: { S: interaction.PK },
      GSIPK_purposeId_eserviceId: {
        S: interaction.GSIPK_purposeId_eserviceId,
      },
      interactionId: { S: interaction.interactionId },
      purposeId: { S: interaction.purposeId },
      eServiceId: { S: interaction.eServiceId },
      descriptorId: { S: interaction.descriptorId },
      state: { S: interaction.state },
      startInteractionTokenIssuedAt: {
        S: issuedAt,
      },
      updatedAt: { S: interaction.updatedAt },
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

export const readInteractionsByPurposeAndEService = async ({
  dynamoDBClient,
  interactionsTable,
  purposeId,
  eServiceId,
}: {
  dynamoDBClient: DynamoDBClient;
  interactionsTable: string;
  purposeId: PurposeId;
  eServiceId: EServiceId;
}): Promise<Interaction[]> => {
  const input: QueryInput = {
    TableName: interactionsTable,
    IndexName: "PurposeEService",
    KeyConditionExpression: "GSIPK_purposeId_eserviceId = :pk",
    ExpressionAttributeValues: {
      ":pk": {
        S: makeGSIPKPurposeIdEServiceId({
          purposeId,
          eServiceId,
        }),
      },
    },
    ConsistentRead: false,
  };

  const data: QueryCommandOutput = await dynamoDBClient.send(
    new QueryCommand(input)
  );

  if (!data.Items || data.Items.length === 0) {
    return [];
  }

  return data.Items.map((item) => {
    const unmarshalled = unmarshall(item);
    const interaction = Interaction.safeParse(unmarshalled);

    if (!interaction.success) {
      throw genericInternalError(
        `Unable to parse interaction entry: result ${JSON.stringify(
          interaction
        )} - data ${JSON.stringify(data)} `
      );
    }

    return interaction.data;
  });
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
  const expressionAttributeValues: NonNullable<
    UpdateItemInput["ExpressionAttributeValues"]
  > = {
    ":state": { S: state },
    ":updatedAt": { S: updatedAt },
  };

  const updateExpressions = ["#state = :state", "updatedAt = :updatedAt"];

  if (state === interactionState.startInteraction) {
    expressionAttributeValues[":startInteractionTokenIssuedAt"] = {
      S: updatedAt,
    };
    updateExpressions.push(
      "startInteractionTokenIssuedAt = :startInteractionTokenIssuedAt"
    );
  }

  if (state === interactionState.callbackInvocation) {
    expressionAttributeValues[":callbackInvocationTokenIssuedAt"] = {
      S: updatedAt,
    };
    updateExpressions.push(
      "callbackInvocationTokenIssuedAt = :callbackInvocationTokenIssuedAt"
    );
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

export const isInteractionStateAllowedForScope = ({
  currentState,
  scope,
}: {
  currentState: InteractionState;
  scope: InteractionState;
}): boolean => interactionStateAllowedByScope[scope].includes(currentState);
