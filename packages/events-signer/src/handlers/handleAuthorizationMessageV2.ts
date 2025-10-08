/* eslint-disable functional/immutable-data */
import { P, match } from "ts-pattern";
import {
  AuthorizationEventV2,
  CorrelationId,
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
import { AuthorizationEventData } from "../models/eventTypes.js";
import { processAndArchiveFiles } from "../utils/fileProcessor.js";

export const handleAuthorizationMessageV2 = async (
  eventsWithTimestamp: Array<{
    authV2: AuthorizationEventV2;
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

  const allAuthorizationDataToStore: AuthorizationEventData[] = [];

  for (const { authV2, timestamp } of eventsWithTimestamp) {
    match(authV2)
      .with({ type: "ClientKeyAdded" }, (event) => {
        if (!event.data.client?.id) {
          throw missingKafkaMessageDataError("clientId", event.type);
        }

        const clientId = event.data.client.id;
        const kid = event.data.kid;
        const userId = JSON.stringify(event.data.client.users);

        allAuthorizationDataToStore.push({
          event_name: event.type,
          id: clientId,
          user_id: userId,
          kid,
          eventTimestamp: timestamp,
          correlationId,
        });
      })
      .with({ type: "ClientKeyDeleted" }, (event) => {
        if (!event.data.client?.id) {
          throw missingKafkaMessageDataError("clientId", event.type);
        }

        const clientId = event.data.client.id;
        const kid = event.data.kid;

        allAuthorizationDataToStore.push({
          event_name: event.type,
          id: clientId,
          kid,
          eventTimestamp: timestamp,
          correlationId,
        });
      })
      .with({ type: "ClientDeleted" }, (event) => {
        if (!event.data.client?.id) {
          throw missingKafkaMessageDataError("clientId", event.type);
        }

        const clientId = event.data.client.id;

        allAuthorizationDataToStore.push({
          event_name: event.type,
          id: clientId,
          eventTimestamp: timestamp,
          correlationId,
        });
      })
      .with(
        P.union(
          { type: "ClientAdded" },
          { type: "ClientAdminRoleRevoked" },
          { type: "ClientAdminRemoved" },
          { type: "ClientUserAdded" },
          { type: "ClientUserDeleted" },
          { type: "ClientAdminSet" },
          { type: "ClientPurposeAdded" },
          { type: "ClientPurposeRemoved" },
          { type: "ProducerKeychainAdded" },
          { type: "ProducerKeychainDeleted" },
          { type: "ProducerKeychainKeyAdded" },
          { type: "ProducerKeychainKeyDeleted" },
          { type: "ProducerKeychainUserAdded" },
          { type: "ProducerKeychainUserDeleted" },
          { type: "ProducerKeychainEServiceAdded" },
          { type: "ProducerKeychainEServiceRemoved" }
        ),
        (event) => {
          loggerInstance.info(
            `Skipping not relevant event type: ${event.type}`
          );
        }
      )
      .exhaustive();
  }

  if (allAuthorizationDataToStore.length > 0) {
    await processAndArchiveFiles<AuthorizationEventData>(
      allAuthorizationDataToStore,
      loggerInstance,
      fileManager,
      signatureService,
      safeStorage,
      correlationId
    );
  } else {
    loggerInstance.info("No managed authorization events to store.");
  }
};
