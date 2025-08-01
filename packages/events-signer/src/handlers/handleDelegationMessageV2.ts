/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  CorrelationId,
  DelegationEventV2,
  fromDelegationV2,
  generateId,
  genericInternalError,
} from "pagopa-interop-models";
import { FileManager, logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { DelegationEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { archiveFileToSafeStorage } from "../services/safeStorageArchivingService.js";
import { prepareNdjsonEventData } from "../utils/ndjsonStore.js";
import { uploadPreparedFileToS3 } from "../utils/s3Uploader.js";

export const handleDelegationMessageV2 = async (
  eventsWithTimestamp: Array<{
    delegationV2: DelegationEventV2;
    timestamp: string;
  }>,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const correlationId = generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: config.serviceName,
    correlationId,
  });

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
            correlationId,
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
          loggerInstance.info(
            `Skipping not relevant event type: ${event.type}`
          );
        }
      )
      .exhaustive();
  }

  if (allDelegationDataToStore.length > 0) {
    const preparedFiles = await prepareNdjsonEventData<DelegationEventData>(
      allDelegationDataToStore,
      loggerInstance
    );

    if (preparedFiles.length === 0) {
      throw genericInternalError(`NDJSON preparation didn't return any files.`);
    }

    for (const preparedFile of preparedFiles) {
      const result = await uploadPreparedFileToS3(
        preparedFile,
        fileManager,
        loggerInstance,
        config
      );
      await archiveFileToSafeStorage(
        result,
        loggerInstance,
        dbService,
        safeStorage,
        safeStorageApiConfig,
        correlationId
      );
    }
  } else {
    loggerInstance.info("No managed delegation events to store.");
  }
};
