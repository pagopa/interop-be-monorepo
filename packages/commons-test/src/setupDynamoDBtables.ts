import {
  CreateTableCommand,
  CreateTableInput,
  DeleteTableCommand,
  DeleteTableInput,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";

export const buildDynamoDBTables = async (
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const platformStatesTableDefinition: CreateTableInput = {
    TableName: "platform-states",
    AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
  };
  const platformStatesCreationCommand = new CreateTableCommand(
    platformStatesTableDefinition
  );
  await dynamoDBClient.send(platformStatesCreationCommand);

  const tokenGenStatesTableDefinition: CreateTableInput = {
    TableName: "token-generation-states",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "GSIPK_eserviceId_descriptorId", AttributeType: "S" },
      { AttributeName: "GSIPK_consumerId_eserviceId", AttributeType: "S" },
      { AttributeName: "GSIPK_purposeId", AttributeType: "S" },
      { AttributeName: "GSIPK_clientId", AttributeType: "S" },
      { AttributeName: "GSIPK_clientId_kid", AttributeType: "S" },
      { AttributeName: "GSIPK_clientId_purposeId", AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "Descriptor",
        KeySchema: [
          {
            AttributeName: "GSIPK_eserviceId_descriptorId",
            KeyType: "HASH",
          },
        ],
        Projection: {
          ProjectionType: "KEYS_ONLY",
        },
      },
      {
        IndexName: "Agreement",
        KeySchema: [
          {
            AttributeName: "GSIPK_consumerId_eserviceId",
            KeyType: "HASH",
          },
        ],
        Projection: {
          ProjectionType: "INCLUDE",
          NonKeyAttributes: [
            "agreementState",
            "descriptorAudience",
            "descriptorState",
            "descriptorVoucherLifespan",
          ],
        },
      },
      {
        IndexName: "Purpose",
        KeySchema: [{ AttributeName: "GSIPK_purposeId", KeyType: "HASH" }],
        Projection: {
          NonKeyAttributes: [
            "agreementId",
            "agreementState",
            "producerId",
            "GSIPK_eserviceId_descriptorId",
            "descriptorAudience",
            "descriptorState",
            "descriptorVoucherLifespan",
            "purposeState",
            "purposeVersionId",
          ],
          ProjectionType: "INCLUDE",
        },
      },
      {
        IndexName: "Client",
        KeySchema: [{ AttributeName: "GSIPK_clientId", KeyType: "HASH" }],
        Projection: {
          ProjectionType: "INCLUDE",
          NonKeyAttributes: [
            "consumerId",
            "clientKind",
            "publicKey",
            "GSIPK_clientId_kid",
          ],
        },
      },
      {
        IndexName: "ClientKid",
        KeySchema: [{ AttributeName: "GSIPK_clientId_kid", KeyType: "HASH" }],
        Projection: {
          ProjectionType: "KEYS_ONLY",
        },
      },
      {
        IndexName: "ClientPurpose",
        KeySchema: [
          { AttributeName: "GSIPK_clientId_purposeId", KeyType: "HASH" },
        ],
        Projection: {
          ProjectionType: "INCLUDE",
          NonKeyAttributes: [
            "GSIPK_clientId",
            "GSIPK_clientId_kid",
            "GSIPK_purposeId",
            "consumerId",
            "clientKind",
            "publicKey",
          ],
        },
      },
    ],
  };
  const tokenGenStatesCreationCommand = new CreateTableCommand(
    tokenGenStatesTableDefinition
  );
  await dynamoDBClient.send(tokenGenStatesCreationCommand);

  const dPoPCacheTableDefinition: CreateTableInput = {
    TableName: "dpop-cache",
    AttributeDefinitions: [
      {
        AttributeName: "jti",
        AttributeType: "S",
      },
    ],
    KeySchema: [
      {
        AttributeName: "jti",
        KeyType: "HASH",
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 5,
    },
    BillingMode: "PAY_PER_REQUEST",
  };
  const dPoPCacheCreationCommand = new CreateTableCommand(
    dPoPCacheTableDefinition
  );
  await dynamoDBClient.send(dPoPCacheCreationCommand);
};

export const deleteDynamoDBTables = async (
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const platformStatesDeleteInput: DeleteTableInput = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    TableName: "platform-states",
  };
  const tokenGenStatesDeleteInput: DeleteTableInput = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    TableName: "token-generation-states",
  };
  const dPoPCacheDeleteInput: DeleteTableInput = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    TableName: "dpop-cache",
  };

  const platformStatesDeleteCommand = new DeleteTableCommand(
    platformStatesDeleteInput
  );
  await dynamoDBClient.send(platformStatesDeleteCommand);
  const tokenGenStatesDeleteCommand = new DeleteTableCommand(
    tokenGenStatesDeleteInput
  );
  await dynamoDBClient.send(tokenGenStatesDeleteCommand);
  const dPoPCacheDeleteCommand = new DeleteTableCommand(dPoPCacheDeleteInput);
  await dynamoDBClient.send(dPoPCacheDeleteCommand);
};
