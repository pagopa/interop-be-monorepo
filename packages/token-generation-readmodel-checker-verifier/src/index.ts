/**
 * This script is used to compare the data of the token generation readmodel with readmodel.
 * The comparison is done by comparing the data from the readmodels with a deep comparison, and if any differences are found,
 * the script will log the differences and exit with a non-zero exit code.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { main as compareTokenGenerationReadModel } from "./utils/utils.js";

const dynamoDBClient = new DynamoDBClient({});
await compareTokenGenerationReadModel(dynamoDBClient);
