/* eslint-disable functional/immutable-data */

import { match, P } from "ts-pattern";
import {
  AgreementEventV2,
  CorrelationId,
  fromAgreementV2,
  generateId,
  genericInternalError,
} from "pagopa-interop-models";
import { FileManager, logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { AgreementEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { prepareNdjsonEventData } from "../utils/ndjsonStore.js";
import { archiveFileToSafeStorage } from "./safeStorageArchivingHandler.js";
import { uploadPreparedFileToS3 } from "./s3UploaderHandler.js";

export const handleAgreementMessageV2 = async (
  eventsWithTimestamp: Array<{
    agreementV2: AgreementEventV2;
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
            "AgreementArchivedByConsumer",
            "AgreementArchivedByRevokedDelegation"
          ),
        },
        (event) => {
          if (!event.data.agreement?.id) {
            throw genericInternalError(
              `Skipping managed Agreement event ${event.type} due to missing agreement ID.`
            );
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
            correlationId,
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
            "AgreementDeletedByRevokedDelegation"
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

  if (allAgreementDataToStore.length > 0) {
    const preparedFiles = await prepareNdjsonEventData<AgreementEventData>(
      allAgreementDataToStore,
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
    loggerInstance.info("No managed agreement events to store.");
  }
};
