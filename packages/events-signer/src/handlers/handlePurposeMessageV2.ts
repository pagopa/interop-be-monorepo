/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */

import { match, P } from "ts-pattern";
import {
  fromPurposeV2,
  fromPurposeVersionStateV2,
  genericInternalError,
  PurposeEventV2,
  PurposeStateV2,
} from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";
import { PurposeEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { FileCreationRequest } from "../models/safeStorageServiceSchema.js";
import { calculateSha256Base64 } from "../utils/checksum.js";

export const handlePurposeMessageV2 = async (
  decodedMessages: PurposeEventV2[],
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allPurposeDataToStore: PurposeEventData[] = [];

  for (const message of decodedMessages) {
    match(message)
      .with({ type: "PurposeAdded" }, (event) => {
        if (!event.data.purpose?.id) {
          throw genericInternalError(
            `Skipping PurposeAdded event due to missing purpose ID.`
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
        });
      })
      .with({ type: "PurposeActivated" }, (event) => {
        if (!event.data.purpose?.id) {
          throw genericInternalError(
            `Skipping PurposeActivated event due to missing purpose ID.`
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
        });
      })
      .with({ type: "PurposeArchived" }, (event) => {
        if (!event.data.purpose?.id) {
          throw new Error(
            `Skipping PurposeArchived event due to missing purpose ID.`
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
            "PurposeVersionRejected"
          ),
        },
        (event) => {
          if (!event.data.purpose?.id || !event.data.versionId) {
            throw genericInternalError(
              `Skipping managed Purpose Version event ${event.type} due to missing purpose ID or version ID.`
            );
          }

          const purpose = fromPurposeV2(event.data.purpose);
          const eventName = event.type;
          const id = purpose.id;
          const versionId = event.data.versionId;

          const relevantVersion = purpose.versions.find(
            (version) => version.id === versionId
          );
          const state = relevantVersion?.state;

          allPurposeDataToStore.push({
            event_name: eventName,
            id,
            versionId,
            state,
          });
        }
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
            "PurposeVersionArchivedByRevokedDelegation"
          ),
        },
        (event) => {
          logger.info(`Skipping not relevant event type: ${event.type}`);
        }
      )
      .exhaustive();
  }

  if (allPurposeDataToStore.length > 0) {
    const timestamp = new Date();
    const documentDestinationPath = `purposes/${timestamp}`;

    const result = await storeNdjsonEventData<PurposeEventData>(
      allPurposeDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );

    if (!result) {
      throw genericInternalError(
        `S3 storing didn't return a valid key or content`
      );
    }

    const { fileContentBuffer, s3PresignedUrl, fileName } = result;

    const checksum = await calculateSha256Base64(fileContentBuffer);

    logger.info(
      `Requesting file creation in Safe Storage for ${s3PresignedUrl}...`
    );

    const safeStorageRequest: FileCreationRequest = {
      contentType: "application/json",
      documentType: safeStorageApiConfig.safeStorageDocType,
      status: safeStorageApiConfig.safeStorageDocStatus,
      checksumValue: checksum,
    };

    const { uploadUrl, secret, key } = await safeStorage.createFile(
      safeStorageRequest
    );

    await safeStorage.uploadFileContent(
      uploadUrl,
      fileContentBuffer,
      "application/json",
      secret,
      checksum
    );

    logger.info("File uploaded to Safe Storage successfully.");

    await dbService.saveSignatureReference({
      safeStorageId: key,
      fileKind: "PLATFORM_EVENTS",
      fileName,
    });
    logger.info("Safe Storage reference saved in DynamoDB.");
  } else {
    logger.info("No managed purpose events to store.");
  }
};
