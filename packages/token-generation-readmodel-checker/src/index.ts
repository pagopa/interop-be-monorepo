import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";
import { compareTokenGenerationReadModel } from "./utils/utils.js";
import { config } from "./configs/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const dynamoDBClient = new DynamoDBClient();
const loggerInstance = logger({
  serviceName: "token-generation-readmodel-checker",
  correlationId: generateId<CorrelationId>(),
});

async function main(): Promise<void> {
  loggerInstance.info(
    "Token generation read model and read model comparison started.\n"
  );
  loggerInstance.info("> Connecting to database...");

  const { db: readModelDB, cleanup } = makeDrizzleConnectionWithCleanup(config);
  const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

  loggerInstance.info("> Connected to database!\n");

  const differencesCount = await compareTokenGenerationReadModel(
    dynamoDBClient,
    readModelServiceSQL,
    loggerInstance
  );

  if (differencesCount > 0) {
    loggerInstance.error(`Differences count: ${differencesCount}`);
  } else {
    loggerInstance.info("No differences found");
  }

  await cleanup();
}

await main();
