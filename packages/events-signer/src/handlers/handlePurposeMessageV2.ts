/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */

import { match, P } from "ts-pattern";
import {
  CorrelationId,
  fromPurposeV2,
  fromPurposeVersionStateV2,
  generateId,
  genericInternalError,
  PurposeEventV2,
  PurposeStateV2,
} from "pagopa-interop-models";
import { FileManager, logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { prepareNdjsonEventData } from "../utils/ndjsonStore.js";
import { PurposeEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { archiveFileToSafeStorage } from "./safeStorageArchivingHandler.js";
import { uploadPreparedFileToS3 } from "./s3UploaderHandler.js";
export const handlePurposeMessageV2 = async (
  eventsWithTimestamp: Array<{ purposeV2: PurposeEventV2; timestamp: string }>,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService,
): Promise<void> => {
  const correlationId = generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: config.serviceName,
    correlationId,
  });
  const allPurposeDataToStore: PurposeEventData[] = [];

  for (const { purposeV2, timestamp } of eventsWithTimestamp) {
    match(purposeV2)
      .with({ type: "PurposeAdded" }, (event) => {
        if (!event.data.purpose?.id) {
          throw new Error(
            `Skipping PurposeAdded event due to missing purpose ID.`,
          );
        }

        const eventName = event.type;
        const state = fromPurposeVersionStateV2(PurposeStateV2.DRAFT);
        const version = event.data.purpose.versions?.[0];

        allPurposeDataToStore.push({
          event_name: eventName,
          id: event.data.purpose.id,
          state,
          versionId: version?.id,
          eventTimestamp: timestamp,
          correlationId,
        });
      })
      .with({ type: "PurposeActivated" }, (event) => {
        if (!event.data.purpose?.id) {
          throw new Error(
            `Skipping PurposeActivated event due to missing purpose ID.`,
          );
        }

        const eventName = event.type;
        const state = fromPurposeVersionStateV2(PurposeStateV2.ACTIVE);
        const id = event.data.purpose.id;
        const version = event.data.purpose.versions?.[0];

        allPurposeDataToStore.push({
          event_name: eventName,
          id,
          state,
          versionId: version.id,
          eventTimestamp: timestamp,
          correlationId,
        });
      })
      .with({ type: "PurposeArchived" }, (event) => {
        if (!event.data.purpose?.id) {
          throw new Error(
            `Skipping PurposeArchived event due to missing purpose ID.`,
          );
        }

        const id = event.data.purpose.id;
        const eventName = event.type;
        const versions = event.data.purpose.versions || [];

        for (const version of versions) {
          const versionId = version.id;
          const state = fromPurposeVersionStateV2(PurposeStateV2.ARCHIVED);

          allPurposeDataToStore.push({
            event_name: eventName,
            id,
            versionId,
            state,
            eventTimestamp: timestamp,
            correlationId,
          });
        }
      })
      .with(
        {
          type: P.union(
            "NewPurposeVersionActivated",
            "NewPurposeVersionWaitingForApproval",
            "PurposeVersionActivated",
            "PurposeVersionOverQuotaUnsuspended",
            "PurposeVersionSuspendedByProducer",
            "PurposeVersionSuspendedByConsumer",
            "PurposeVersionUnsuspendedByProducer",
            "PurposeVersionUnsuspendedByConsumer",
            "PurposeVersionRejected",
          ),
        },
        (event) => {
          if (!event.data.purpose?.id || !event.data.versionId) {
            throw genericInternalError(
              `Skipping managed Purpose Version event ${event.type} due to missing purpose ID or version ID.`,
            );
          }

          const purpose = fromPurposeV2(event.data.purpose);
          const eventName = event.type;
          const id = purpose.id;
          const versionId = event.data.versionId;

          const relevantVersion = purpose.versions.find(
            (version) => version.id === versionId,
          );
          const state = relevantVersion?.state;

          allPurposeDataToStore.push({
            event_name: eventName,
            id,
            versionId,
            state,
            eventTimestamp: timestamp,
            correlationId,
          });
        },
      )
      .with(
        {
          type: P.union(
            "DraftPurposeUpdated",
            "PurposeWaitingForApproval",
            "DraftPurposeDeleted",
            "WaitingForApprovalPurposeDeleted",
            "WaitingForApprovalPurposeVersionDeleted",
            "PurposeCloned",
            "PurposeDeletedByRevokedDelegation",
            "PurposeVersionArchivedByRevokedDelegation",
          ),
        },
        (event) => {
          loggerInstance.info(
            `Skipping not relevant event type: ${event.type}`,
          );
        },
      )
      .exhaustive();
  }

  if (allPurposeDataToStore.length > 0) {
    const preparedFiles = await prepareNdjsonEventData<PurposeEventData>(
      allPurposeDataToStore,
      loggerInstance,
    );

    if (preparedFiles.length === 0) {
      throw genericInternalError(`NDJSON preparation didn't return any files.`);
    }

    for (const preparedFile of preparedFiles) {
      const result = await uploadPreparedFileToS3(
        preparedFile,
        fileManager,
        loggerInstance,
        config,
      );
      await archiveFileToSafeStorage(
        result,
        loggerInstance,
        dbService,
        safeStorage,
        safeStorageApiConfig,
        correlationId,
      );
    }
  } else {
    loggerInstance.info("No managed purpose events to store.");
  }
};
