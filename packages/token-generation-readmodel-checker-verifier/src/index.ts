// TODO: remove no-console
/* eslint-disable no-console */
/**
 * This script is used to compare the data of the token generation readmodel with readmodel.
 * The comparison is done by comparing the data from the read models with a deep comparison, and if any differences are found,
 * the script will log the differences and exit with a non-zero exit code.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { compareTokenGenerationReadModel } from "./utils/utils.js";

const dynamoDBClient = new DynamoDBClient({});
const loggerInstance = logger({
  serviceName: "token-generation-readmodel-checker-verifier",
  correlationId: generateId<CorrelationId>(),
});

async function main(): Promise<void> {
  const differencesCount = await compareTokenGenerationReadModel(
    dynamoDBClient,
    loggerInstance
  );

  console.log("Differences count: ", differencesCount);

  if (differencesCount > 0) {
    process.exit(1);
  }

  console.info("No differences found");
}

await main();
