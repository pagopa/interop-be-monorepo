/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */

import { match, P } from "ts-pattern";
import {
  CorrelationId,
  fromPurposeV2,
  fromPurposeVersionStateV2,
  generateId,
  missingKafkaMessageDataError,
  PurposeEventV2,
  PurposeStateV2,
} from "pagopa-interop-models";
import {
  FileManager,
  logger,
  SafeStorageService,
  SignatureServiceBuilder,
} from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { PurposeEventData } from "../models/eventTypes.js";
import { processAndArchiveFiles } from "../utils/fileProcessor.js";
export const handlePurposeMessageV2 = async (
  eventsWithTimestamp: Array<{ purposeV2: PurposeEventV2; timestamp: string }>,
  fileManager: FileManager,
  signatureService: SignatureServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const correlationId = generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: config.serviceName,
    correlationId,
  });
  const allPurposeDataToStore: PurposeEventData[] = [];

  for (const { purposeV2, timestamp } of eventsWithTimestamp) {
    match(purposeV2)
      .with({ type: P.union("PurposeAdded", "PurposeCloned") }, (event) => {
        if (!event.data.purpose?.id) {
          throw missingKafkaMessageDataError("purposeId", event.type);
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
          throw missingKafkaMessageDataError("purposeId", event.type);
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
          throw missingKafkaMessageDataError("purposeId", event.type);
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
            "PurposeVersionArchivedByRevokedDelegation"
          ),
        },
        (event) => {
          if (!event.data.purpose?.id || !event.data.versionId) {
            throw missingKafkaMessageDataError("purposeId", event.type);
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
            eventTimestamp: timestamp,
            correlationId,
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
            "PurposeDeletedByRevokedDelegation",
            "RiskAnalysisDocumentGenerated"
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

  if (allPurposeDataToStore.length > 0) {
    await processAndArchiveFiles<PurposeEventData>(
      allPurposeDataToStore,
      loggerInstance,
      fileManager,
      signatureService,
      safeStorage,
      correlationId
    );
  } else {
    loggerInstance.info("No managed purpose events to store.");
  }
};
