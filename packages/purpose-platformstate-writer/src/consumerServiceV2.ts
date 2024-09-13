import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  fromPurposeV2,
  genericInternalError,
  makePlatformStatesPurposePK,
  PlatformStatesPurposeEntry,
  PurposeEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  purposeStateToItemState,
  readPlatformPurposeEntry,
  updatePurposeStateInPlatformStatesEntry,
  updatePurposeStateInTokenGenerationStatesTable,
  writePlatformPurposeEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: PurposeEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "PurposeActivated" }, async (msg) => {
      const purposeV2 = msg.data.purpose;
      if (!purposeV2) {
        throw genericInternalError(`Purpose not found in message data`);
      }
      const purpose = fromPurposeV2(purposeV2);
      const primaryKey = makePlatformStatesPurposePK(unsafeBrandId(purpose.id));
      const purposeState = purposeStateToItemState(purpose);
      const existingPurposeEntry = await readPlatformPurposeEntry(
        primaryKey,
        dynamoDBClient
      );

      if (existingPurposeEntry && existingPurposeEntry.version > msg.version) {
        // Stops processing if the message is older than the purpose entry
        return Promise.resolve();
      } else if (
        existingPurposeEntry &&
        existingPurposeEntry.version <= msg.version
      ) {
        await updatePurposeStateInPlatformStatesEntry(
          dynamoDBClient,
          primaryKey,
          purposeState,
          msg.version
        );

        // token-generation-states
        await updatePurposeStateInTokenGenerationStatesTable(
          purpose,
          dynamoDBClient
        );
      } else {
        const purposeEntry: PlatformStatesPurposeEntry = {
          PK: primaryKey,
          state: purposeState,
          purposeVersionId: purpose.versions[0].id, // always length == 1
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };

        await writePlatformPurposeEntry(purposeEntry, dynamoDBClient);

        // token-generation-states
        await updatePurposeStateInTokenGenerationStatesTable(
          purpose,
          dynamoDBClient
        );
      }
    })
    .with(
      { type: "NewPurposeVersionActivated" },
      { type: "PurposeVersionActivated" },
      async (_msg) => Promise.resolve()
    )
    .with(
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      async (_msg) => Promise.resolve()
    )
    .with({ type: "PurposeArchived" }, async (_msg) => Promise.resolve())
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
