import { Logger } from "pagopa-interop-commons";
import { AsyncTokenGenerationReadModelService } from "../services/asyncTokenGenerationReadModelService.js";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { collectReadModelContext } from "./common.js";
import {
  compareAsyncPlatformStates,
  compareAsyncPlatformStatesPages,
} from "./platformStates.js";
import {
  compareAsyncTokenGenerationStates,
  compareAsyncTokenGenerationStatesPages,
} from "./tokenGenerationStates.js";
import {
  compareProducerKeychainPlatformStates,
  compareProducerKeychainPlatformStatesPages,
} from "./producerKeychainPlatformStates.js";
import {
  compareInteractions,
  compareInteractionsPages,
} from "./interactions.js";

export {
  compareAsyncPlatformStates,
  compareAsyncTokenGenerationStates,
  compareInteractions,
  compareProducerKeychainPlatformStates,
};

export const compareAsyncTokenGenerationReadModel = async ({
  asyncTokenGenerationReadModelService,
  readModelService,
  logger,
  interactionTtlEpsilonSeconds,
}: {
  asyncTokenGenerationReadModelService: AsyncTokenGenerationReadModelService;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  interactionTtlEpsilonSeconds: number | undefined;
}): Promise<number> => {
  const readModelContext = await collectReadModelContext(readModelService);
  const asyncPlatformStatesComparison = await compareAsyncPlatformStatesPages({
    eservices: readModelContext.eservices,
    platformStatesPages:
      asyncTokenGenerationReadModelService.readPlatformStatesItemsPages(),
    logger,
  });

  return (
    asyncPlatformStatesComparison.differencesCount +
    (await compareAsyncTokenGenerationStatesPages({
      readModelContext,
      tokenGenerationStatesPages:
        asyncTokenGenerationReadModelService.readTokenGenerationStatesItemsPages(),
      logger,
    })) +
    (await compareProducerKeychainPlatformStatesPages({
      producerKeychains: readModelContext.producerKeychains,
      producerKeychainPlatformStatesPages:
        asyncTokenGenerationReadModelService.readProducerKeychainPlatformStatesItemsPages(),
      logger,
    })) +
    (await compareInteractionsPages({
      rawInteractionsPages:
        asyncTokenGenerationReadModelService.readInteractionsItemsPages(),
      readModelContext,
      asyncPlatformStatesByPK:
        asyncPlatformStatesComparison.asyncPlatformStatesByPK,
      interactionTtlEpsilonSeconds,
      logger,
    }))
  );
};
