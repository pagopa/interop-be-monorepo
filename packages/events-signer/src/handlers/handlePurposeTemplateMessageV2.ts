/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */

import { match, P } from "ts-pattern";
import {
  CorrelationId,
  fromPurposeTemplateStateV2,
  generateId,
  missingKafkaMessageDataError,
  PurposeTemplateEventV2,
} from "pagopa-interop-models";
import {
  FileManager,
  logger,
  SafeStorageService,
  SignatureServiceBuilder,
} from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { PurposeTemplateEventData } from "../models/eventTypes.js";
import { processAndArchiveFiles } from "../utils/fileProcessor.js";

export const handlePurposeTemplateMessageV2 = async (
  eventsWithTimestamp: Array<{
    purposeV2: PurposeTemplateEventV2;
    timestamp: Date;
  }>,
  fileManager: FileManager,
  signatureService: SignatureServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const correlationId = generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: config.serviceName,
    correlationId,
  });
  const allPurposeTemplateDataToStore: PurposeTemplateEventData[] = [];

  for (const { purposeV2, timestamp } of eventsWithTimestamp) {
    match(purposeV2)
      .with(
        {
          type: P.union(
            "PurposeTemplateAdded",
            "PurposeTemplateArchived",
            "PurposeTemplatePublished"
          ),
        },
        (event) => {
          if (!event.data.purposeTemplate?.id) {
            throw missingKafkaMessageDataError("id", event.type);
          }
          const eventName = event.type;
          const state = fromPurposeTemplateStateV2(
            event.data.purposeTemplate.state
          );

          allPurposeTemplateDataToStore.push({
            event_name: eventName,
            id: event.data.purposeTemplate.id,
            state,
            eventTimestamp: timestamp,
            correlationId,
          });
        }
      )

      .with(
        {
          type: P.union(
            "PurposeTemplateAnnotationDocumentAdded",
            "PurposeTemplateAnnotationDocumentDeleted",
            "PurposeTemplateAnnotationDocumentUpdated",
            "PurposeTemplateDraftDeleted",
            "PurposeTemplateDraftUpdated",
            "PurposeTemplateEServiceLinked",
            "PurposeTemplateEServiceUnlinked",
            "PurposeTemplateSuspended",
            "PurposeTemplateUnsuspended",
            "RiskAnalysisTemplateDocumentGenerated",
            "RiskAnalysisTemplateSignedDocumentGenerated"
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

  if (allPurposeTemplateDataToStore.length > 0) {
    await processAndArchiveFiles<PurposeTemplateEventData>(
      allPurposeTemplateDataToStore,
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
