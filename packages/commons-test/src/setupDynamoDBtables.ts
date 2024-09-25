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
  const platformTableDefinition: CreateTableInput = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    TableName: "platform-states",
    AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
  };
  const command1 = new CreateTableCommand(platformTableDefinition);
  await dynamoDBClient.send(command1);

  const tokenGenerationTableDefinition: CreateTableInput = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    TableName: "token-generation-states",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "GSIPK_eserviceId_descriptorId", AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSIPK_eserviceId_descriptorId",
        KeySchema: [
          {
            AttributeName: "GSIPK_eserviceId_descriptorId",
            KeyType: "HASH",
          },
        ],
        Projection: {
          NonKeyAttributes: [],
          ProjectionType: "ALL",
        },
        // ProvisionedThroughput: {
        //   ReadCapacityUnits: 5,
        //   WriteCapacityUnits: 5,
        // },
      },
    ],
  };
  const command2 = new CreateTableCommand(tokenGenerationTableDefinition);
  await dynamoDBClient.send(command2);
  // console.log(result);

  // const tablesResult = await dynamoDBClient.listTables();
  // console.log(tablesResult.TableNames);
};

export const deleteDynamoDBTables = async (
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const tableToDelete1: DeleteTableInput = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    TableName: "platform-states",
  };
  const tableToDelete2: DeleteTableInput = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    TableName: "token-generation-states",
  };
  const command1 = new DeleteTableCommand(tableToDelete1);
  await dynamoDBClient.send(command1);
  const command2 = new DeleteTableCommand(tableToDelete2);
  await dynamoDBClient.send(command2);
};
