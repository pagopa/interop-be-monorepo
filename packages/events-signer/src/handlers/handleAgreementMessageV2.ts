/* eslint-disable functional/immutable-data */

import { match, P } from "ts-pattern";
import {
  AgreementEventV2,
  fromAgreementV2,
  genericInternalError,
} from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { AgreementEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";
import { processStoredFilesForSafeStorage } from "../utils/safeStorageProcessor.js";

export const handleAgreementMessageV2 = async (
  eventsWithTimestamp: Array<{
    agreementV2: AgreementEventV2;
    timestamp: string;
  }>,
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allAgreementDataToStore: AgreementEventData[] = [];

  for (const { agreementV2, timestamp } of eventsWithTimestamp) {
    match(agreementV2)
      .with(
        {
          type: P.union(
            "AgreementSubmitted",
            "AgreementRejected",
            "AgreementActivated",
            "AgreementSuspendedByProducer",
            "AgreementSuspendedByConsumer",
            "AgreementSuspendedByPlatform",
            "AgreementUnsuspendedByProducer",
            "AgreementUnsuspendedByConsumer",
            "AgreementUnsuspendedByPlatform",
            "AgreementArchivedByUpgrade",
            "AgreementArchivedByConsumer"
          ),
        },
        (event) => {
          if (!event.data.agreement?.id) {
            logger.warn(
              `Skipping managed Agreement event ${event.type} due to missing agreement ID.`
            );
            return;
          }
          const agreement = fromAgreementV2(event.data.agreement);
          const eventName = event.type;
          const id = agreement.id;
          const state = agreement.state;

          allAgreementDataToStore.push({
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
            "AgreementAdded",
            "AgreementDeleted",
            "DraftAgreementUpdated",
            "AgreementUpgraded",
            "AgreementConsumerDocumentAdded",
            "AgreementConsumerDocumentRemoved",
            "AgreementSetDraftByPlatform",
            "AgreementSetMissingCertifiedAttributesByPlatform",
            "AgreementDeletedByRevokedDelegation",
            "AgreementArchivedByRevokedDelegation"
          ),
        },
        (event) => {
          logger.info(`Skipping not relevant event type: ${event.type}`);
        }
      )
      .exhaustive();
  }

  if (allAgreementDataToStore.length > 0) {
    const storedFiles = await storeNdjsonEventData<AgreementEventData>(
      allAgreementDataToStore,
      fileManager,
      logger,
      config
    );

    if (!storedFiles) {
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
    logger.info("No managed agreement events to store.");
  }
};
