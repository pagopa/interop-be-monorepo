import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  PlatformStatesPurposeEntry,
  PurposeEventEnvelopeV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  deletePlatformPurposeEntry,
  getPurposeDataFromMessage,
  getPurposeVersionFromEvent,
  updatePurposeStateInPlatformStatesEntry,
  updatePurposeStatesInTokenGenerationStatesTable,
  updatePurposeVersionIdInPlatformStatesEntry,
  updatePurposeVersionIdInTokenGenerationStatesTable,
  writePlatformPurposeEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: PurposeEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "PurposeActivated" }, async (msg) => {
      const { purpose, primaryKey, purposeState, existingPurposeEntry } =
        await getPurposeDataFromMessage(dynamoDBClient, msg);

      if (existingPurposeEntry && existingPurposeEntry.version > msg.version) {
        // Stops processing if the message is older than the purpose entry
        return Promise.resolve();
      } else if (
        existingPurposeEntry &&
        existingPurposeEntry.version <= msg.version
      ) {
        // platform-states
        await updatePurposeStateInPlatformStatesEntry(
          dynamoDBClient,
          primaryKey,
          purposeState,
          msg.version
        );
      } else {
        // platform-states
        const purposeEntry: PlatformStatesPurposeEntry = {
          PK: primaryKey,
          state: purposeState,
          purposeVersionId: purpose.versions[0].id, // always length == 1
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await writePlatformPurposeEntry(dynamoDBClient, purposeEntry);
      }

      // token-generation-states
      // TODO: add missing updates
      await updatePurposeStatesInTokenGenerationStatesTable(
        dynamoDBClient,
        purpose
      );
      await updatePurposeVersionIdInTokenGenerationStatesTable(
        dynamoDBClient,
        purpose,
        purpose.versions[0].id
      );
    })
    .with(
      { type: "NewPurposeVersionActivated" },
      { type: "PurposeVersionActivated" },
      async (msg) => {
        const { purpose, primaryKey, purposeState, existingPurposeEntry } =
          await getPurposeDataFromMessage(dynamoDBClient, msg);

        if (
          !existingPurposeEntry ||
          existingPurposeEntry.version > msg.version
        ) {
          // Stops processing if the message is older than the purpose entry or if it doesn't exist
          return Promise.resolve();
        } else {
          // platform-states
          await updatePurposeStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            purposeState,
            msg.version
          );
          await updatePurposeVersionIdInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            getPurposeVersionFromEvent(msg, msg.type).id,
            msg.version
          );

          // token-generation-states
          await updatePurposeStatesInTokenGenerationStatesTable(
            dynamoDBClient,
            purpose
          );
          await updatePurposeVersionIdInTokenGenerationStatesTable(
            dynamoDBClient,
            purpose,
            getPurposeVersionFromEvent(msg, msg.type).id
          );
        }
      }
    )
    .with(
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      async (msg) => {
        const { purpose, primaryKey, purposeState, existingPurposeEntry } =
          await getPurposeDataFromMessage(dynamoDBClient, msg);

        if (
          !existingPurposeEntry ||
          existingPurposeEntry.version > msg.version
        ) {
          // Stops processing if the message is older than the purpose entry or if it doesn't exist
          return Promise.resolve();
        } else {
          // platform-states
          await updatePurposeStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            purposeState,
            msg.version
          );

          // token-generation-states
          await updatePurposeStatesInTokenGenerationStatesTable(
            dynamoDBClient,
            purpose
          );
        }
      }
    )
    .with({ type: "PurposeArchived" }, async (msg) => {
      const { purpose, primaryKey } = await getPurposeDataFromMessage(
        dynamoDBClient,
        msg
      );

      // platform-states
      await deletePlatformPurposeEntry(dynamoDBClient, primaryKey);

      // token-generation-states
      await updatePurposeStatesInTokenGenerationStatesTable(
        dynamoDBClient,
        purpose
      );
    })
    .with(
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeWaitingForApproval" },
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      { type: "PurposeCloned" },
      () => Promise.resolve()
    )
    .exhaustive();
}
