/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import { PurposeEventV2, PurposeStateV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { PurposeEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";

export const handlePurposeMessageV2 = async (
  decodedMessages: PurposeEventV2[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
): Promise<void> => {
  const allPurposeDataToStore: PurposeEventData[] = [];

  for (const message of decodedMessages) {
    match(message)
      .with({ type: "PurposeAdded" }, (event) => {
        if (!event.data.purpose?.id) {
          logger.warn(`Skipping PurposeAdded event due to missing purpose ID.`);
          return;
        }

        const eventName = event.type;
        const state = PurposeStateV2.DRAFT;
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
          throw new Error(
            `Skipping PurposeActivated event due to missing purpose ID.`
          );
        }

        const eventName = event.type;
        const state = PurposeStateV2.ACTIVE;
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
          const state = PurposeStateV2.ARCHIVED;

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
            throw new Error(
              `Skipping managed Purpose Version event ${event.type} due to missing purpose ID or version ID.`
            );
          }

          const eventName = event.type;
          const id = event.data.purpose.id;
          const versionId = event.data.versionId;

          const relevantVersion = event.data.purpose.versions.find(
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
    const documentDestinationPath = `purposes/${new Date()}`;

    await storeEventDataInNdjson<PurposeEventData>(
      allPurposeDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );
  }
};
