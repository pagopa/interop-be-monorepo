import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { compareTokenGenerationReadModel } from "./utils/utils.js";

const dynamoDBClient = new DynamoDBClient();
const loggerInstance = logger({
  serviceName: "token-generation-readmodel-checker",
  correlationId: generateId<CorrelationId>(),
});

async function main(): Promise<void> {
  const differencesCount = await compareTokenGenerationReadModel(
    dynamoDBClient,
    loggerInstance
  );

  if (differencesCount > 0) {
    loggerInstance.error(`Differences count: ${differencesCount}`);
  } else {
    loggerInstance.info("No differences found");
  }
}

await main();

process.exit(0);
