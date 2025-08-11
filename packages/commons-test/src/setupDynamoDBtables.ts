import fs, { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
  const platformStatesSchemaPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../docker/dynamo-db/schema/platform-states-dynamo-db.json"
  );
  const platformStatesTableDefinition: CreateTableInput = JSON.parse(
    readFileSync(platformStatesSchemaPath, "utf-8")
  );
  const platformStatesCreationCommand = new CreateTableCommand(
    platformStatesTableDefinition
  );
  await dynamoDBClient.send(platformStatesCreationCommand);

  const tokenGenStatesSchemaPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../docker/dynamo-db/schema/token-generation-states-dynamo-db.json"
  );
  const tokenGenStatesTableDefinition: CreateTableInput = JSON.parse(
    fs.readFileSync(tokenGenStatesSchemaPath, "utf8")
  );
  const tokenGenStatesCreationCommand = new CreateTableCommand(
    tokenGenStatesTableDefinition
  );
  await dynamoDBClient.send(tokenGenStatesCreationCommand);

  const dpopCacheSchemaPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../docker/dynamo-db/schema/dpop-cache-dynamo-db.json"
  );
  const dpopCacheTableDefinition: CreateTableInput = JSON.parse(
    fs.readFileSync(dpopCacheSchemaPath, "utf8")
  );
  const dpopCacheCreationCommand = new CreateTableCommand(
    dpopCacheTableDefinition
  );
  await dynamoDBClient.send(dpopCacheCreationCommand);

  const signatureReferencesSchemaPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../docker/dynamo-db/schema/signature-references-dynamo-db.json"
  );
  const signatureReferencesTableDefinition: CreateTableInput = JSON.parse(
    fs.readFileSync(signatureReferencesSchemaPath, "utf8")
  );
  const signatureReferencesCreationCommand = new CreateTableCommand(
    signatureReferencesTableDefinition
  );
  await dynamoDBClient.send(signatureReferencesCreationCommand);
};

export const deleteDynamoDBTables = async (
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const platformStatesDeleteInput: DeleteTableInput = {
    TableName: "platform-states",
  };
  const tokenGenStatesDeleteInput: DeleteTableInput = {
    TableName: "token-generation-states",
  };
  const dpopCacheDeleteInput: DeleteTableInput = {
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
  const dpopCacheDeleteCommand = new DeleteTableCommand(dpopCacheDeleteInput);
  await dynamoDBClient.send(dpopCacheDeleteCommand);

  const signatureReferencesDeleteInput: DeleteTableInput = {
    TableName: "SignatureReferencesTable",
  };
  const signatureReferencesDeleteCommand = new DeleteTableCommand(
    signatureReferencesDeleteInput
  );
  await dynamoDBClient.send(signatureReferencesDeleteCommand);
};
