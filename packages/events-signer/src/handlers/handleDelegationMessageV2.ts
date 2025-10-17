/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  CorrelationId,
  DelegationEventV2,
  fromDelegationV2,
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
import { DelegationEventData } from "../models/eventTypes.js";
import { processAndArchiveFiles } from "../utils/fileProcessor.js";

export const handleDelegationMessageV2 = async (
  eventsWithTimestamp: Array<{
    delegationV2: DelegationEventV2;
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
            throw missingKafkaMessageDataError("delegationId", event.type);
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
    await processAndArchiveFiles<DelegationEventData>(
      allDelegationDataToStore,
      loggerInstance,
      fileManager,
      signatureService,
      safeStorage,
      correlationId
    );
  } else {
    loggerInstance.info("No managed delegation events to store.");
  }
};
