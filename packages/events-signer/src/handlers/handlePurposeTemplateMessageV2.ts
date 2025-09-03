/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */

import { match, P } from "ts-pattern";
import {
  CorrelationId,
  generateId,
  genericInternalError,
  PurposeTemplateEventV2,
} from "pagopa-interop-models";
import { FileManager, logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { prepareNdjsonEventData } from "../utils/ndjsonStore.js";
import {
  PurposeEventData,
  PurposeTemplateEventData,
} from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { archiveFileToSafeStorage } from "./safeStorageArchivingHandler.js";
import { uploadPreparedFileToS3 } from "./s3UploaderHandler.js";
export const handlePurposeTemplateMessageV2 = async (
  eventsWithTimestamp: Array<{
    purposeTemplateV2: PurposeTemplateEventV2;
    timestamp: string;
  }>,
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

  for (const { purposeTemplateV2, timestamp } of eventsWithTimestamp) {
    match(purposeTemplateV2)
      .with(
        {
          type: P.union(
            "PurposeTemplateAdded",
            "PurposeTemplateDraftUpdated",
            "PurposeTemplatePublished",
            "PurposeTemplateUnsuspended",
            "PurposeTemplateSuspended",
            "PurposeTemplateArchived",
          ),
        },
        (event) => {
          if (!event.data.purposeTemplate?.id) {
            throw new Error(
              `Purpose Template id can't be missing on event message for event type: ${event.type}`,
            );
          }

          const eventName = event.type;
          const id = event.data.purposeTemplate.id;

          allPurposeDataToStore.push({
            event_name: eventName,
            id,
            eventTimestamp: timestamp,
            correlationId,
          });
        },
      )
      .with(
        {
          type: P.union(
            "PurposeTemplateEServiceLinked",
            "PurposeTemplateEServiceUnlinked",
          ),
        },
        (event) => {
          if (!event.data.purposeTemplateId) {
            throw new Error(
              `Purpose Template id can't be missing on event message for event type: ${event.type}`,
            );
          }
          const eventName = event.type;
          const id = event.data.purposeTemplateId;

          allPurposeDataToStore.push({
            event_name: eventName,
            id,
            eventTimestamp: timestamp,
            correlationId,
          });
        },
      )
      .with({ type: "PurposeTemplateDraftDeleted" }, (event) => {
        loggerInstance.info(`Skipping not relevant event type: ${event.type}`);
      })
      .exhaustive();
  }

  if (allPurposeDataToStore.length > 0) {
    const preparedFiles =
      await prepareNdjsonEventData<PurposeTemplateEventData>(
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
