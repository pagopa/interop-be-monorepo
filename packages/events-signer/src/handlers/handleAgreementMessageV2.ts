/* eslint-disable functional/immutable-data */

import { match, P } from "ts-pattern";
import {
  AgreementEventV2,
  CorrelationId,
  fromAgreementV2,
  generateId,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import {
  FileManager,
  logger,
  SafeStorageService,
  SignatureServiceBuilder,
} from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { AgreementEventData } from "../models/eventTypes.js";
import { processAndArchiveFiles } from "../utils/fileProcessor.js";

export const handleAgreementMessageV2 = async (
  eventsWithTimestamp: Array<{
    agreementV2: AgreementEventV2;
    timestamp: string;
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
            throw missingKafkaMessageDataError("agreementId", event.type);
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
            "AgreementDeletedByRevokedDelegation",
            "AgreementContractGenerated",
            "AgreementSignedContractGenerated"
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
    await processAndArchiveFiles<AgreementEventData>(
      allAgreementDataToStore,
      loggerInstance,
      fileManager,
      signatureService,
      safeStorage,
      correlationId
    );
  } else {
    loggerInstance.info("No managed agreement events to store.");
  }
};
