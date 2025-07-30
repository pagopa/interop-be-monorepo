/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  DelegationEventV2,
  fromDelegationV2,
  genericInternalError,
} from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";
import { DelegationEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { processStoredFilesForSafeStorage } from "../services/safeStorageArchivingService.js";

export const handleDelegationMessageV2 = async (
  eventsWithTimestamp: Array<{
    delegationV2: DelegationEventV2;
    timestamp: string;
  }>,
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allDelegationDataToStore: DelegationEventData[] = [];

  for (const { delegationV2, timestamp } of eventsWithTimestamp) {
    match(delegationV2)
      .with(
        {
          type: P.union(
            "ProducerDelegationApproved",
            "ProducerDelegationRevoked",
            "ConsumerDelegationApproved",
            "ConsumerDelegationRevoked"
          ),
        },
        (event) => {
          if (!event.data.delegation?.id) {
            throw genericInternalError(
              `Skipping managed Delegation event ${event.type} due to missing delegation ID.`
            );
          }
          const delegation = fromDelegationV2(event.data.delegation);
          const eventName = event.type;
          const id = delegation.id;
          const state = delegation.state;

          allDelegationDataToStore.push({
            event_name: eventName,
            id,
            state,
            eventTimestamp: timestamp,
          });
        }
      )
      .with(
        {
          type: P.union(
            "ProducerDelegationSubmitted",
            "ProducerDelegationRejected",
            "ConsumerDelegationSubmitted",
            "ConsumerDelegationRejected"
          ),
        },
        (event) => {
          logger.info(`Skipping not relevant event type: ${event.type}`);
        }
      )
      .exhaustive();
  }

  if (allDelegationDataToStore.length > 0) {
    const storedFiles = await storeNdjsonEventData<DelegationEventData>(
      allDelegationDataToStore,
      fileManager,
      logger,
      config
    );

    if (storedFiles.length === 0) {
      throw genericInternalError(
        `S3 storing didn't return a valid key or content`
      );
    }

    await processStoredFilesForSafeStorage(
      storedFiles,
      logger,
      dbService,
      safeStorage,
      safeStorageApiConfig
    );
  } else {
    logger.info("No managed delegation events to store.");
  }
};
