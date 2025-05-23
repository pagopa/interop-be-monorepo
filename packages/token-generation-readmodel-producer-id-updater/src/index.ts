import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { addProducerIdToTokenGenReadModel } from "./utils/utils.js";
import { config } from "./configs/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";

const dynamoDBClient = new DynamoDBClient();
const loggerInstance = logger({
  serviceName: "token-generation-readmodel-producer-id-updater",
  correlationId: generateId<CorrelationId>(),
});

async function main(): Promise<void> {
  loggerInstance.info(
    "Script to populate producerId in the token generation read model started."
  );

  loggerInstance.info("> Connecting to database...");
  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );
  loggerInstance.info("> Connected to database!\n");

  const { platformStatesUpdateCount, tokenGenStatesUpdateCount } =
    await addProducerIdToTokenGenReadModel(
      dynamoDBClient,
      readModelService,
      loggerInstance
    );

  loggerInstance.info(
    `Script to populate producerId in the token generation read model ended.
Platform-states: updated ${platformStatesUpdateCount} records.
Token-generation-states: updated ${tokenGenStatesUpdateCount} records.`
  );
}

await main();

process.exit(0);
