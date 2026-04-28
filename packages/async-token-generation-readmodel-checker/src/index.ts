import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";
import { config } from "./configs/config.js";
import { asyncTokenGenerationReadModelServiceBuilder } from "./services/asyncTokenGenerationReadModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { compareAsyncTokenGenerationReadModel } from "./utils/utils.js";

const dynamoDBClient = new DynamoDBClient();
const loggerInstance = logger({
  serviceName: "async-token-generation-readmodel-checker",
  correlationId: generateId<CorrelationId>(),
});

async function main(): Promise<void> {
  loggerInstance.info(
    "Async token generation read model comparison started.\n"
  );
  loggerInstance.info("> Connecting to database...");

  const { db: readModelDB, cleanup } = makeDrizzleConnectionWithCleanup(config);
  try {
    const readModelService = readModelServiceBuilderSQL(readModelDB);
    const asyncTokenGenerationReadModelService =
      asyncTokenGenerationReadModelServiceBuilder(dynamoDBClient);

    loggerInstance.info("> Connected to database!\n");

    const differencesCount = await compareAsyncTokenGenerationReadModel({
      asyncTokenGenerationReadModelService,
      readModelService,
      logger: loggerInstance,
      interactionTtlEpsilonSeconds: config.interactionTtlEpsilonSeconds,
    });

    if (differencesCount > 0) {
      loggerInstance.error(`Differences count: ${differencesCount}`);
    } else {
      loggerInstance.info("No differences found");
    }
  } finally {
    await cleanup();
  }
}

await main();
