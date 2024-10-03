import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  fromPurposeV2,
  ItemState,
  makePlatformStatesPurposePK,
  missingKafkaMessageDataError,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  Purpose,
  PurposeEventEnvelopeV2,
  PurposeV2,
  PurposeVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  deletePlatformPurposeEntry,
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
  updatePurposeDataInPlatformStatesEntry,
  updatePurposeDataInTokenGenerationStatesTable,
  writePlatformPurposeEntry,
  updatePurposeEntriesInTokenGenerationStatesTable,
} from "./utils.js";

export async function handleMessageV2(
  message: PurposeEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "PurposeActivated" }, async (msg) => {
      const { purpose, primaryKey, purposeState, existingPurposeEntry } =
        await parsePurpose({
          dynamoDBClient,
          purposeV2: msg.data.purpose,
          msgType: msg.type,
        });

      if (existingPurposeEntry) {
        if (existingPurposeEntry.version > msg.version) {
          // Stops processing if the message is older than the purpose entry
          return Promise.resolve();
        } else {
          // platform-states
          await updatePurposeDataInPlatformStatesEntry({
            dynamoDBClient,
            primaryKey,
            purposeState,
            version: msg.version,
          });
        }
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
      await updatePurposeEntriesInTokenGenerationStatesTable(
        dynamoDBClient,
        purpose,
        purposeState,
        purpose.versions[0].id
      );
    })
    .with(
      { type: "NewPurposeVersionActivated" },
      { type: "PurposeVersionActivated" },
      async (msg) => {
        const {
          purpose,
          primaryKey,
          purposeState,
          existingPurposeEntry,
          purposeVersionId,
        } = await parsePurpose({
          dynamoDBClient,
          purposeV2: msg.data.purpose,
          msgType: msg.type,
          purposeVersionId: msg.data.versionId,
        });

        if (
          !existingPurposeEntry ||
          existingPurposeEntry.version > msg.version
        ) {
          // Stops processing if the message is older than the purpose entry or if it doesn't exist
          return Promise.resolve();
        } else {
          // platform-states
          await updatePurposeDataInPlatformStatesEntry({
            dynamoDBClient,
            primaryKey,
            purposeState,
            version: msg.version,
            purposeVersionId,
          });

          // token-generation-states
          await updatePurposeDataInTokenGenerationStatesTable({
            dynamoDBClient,
            purposeId: purpose.id,
            purposeState,
            purposeVersionId,
          });
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
          await parsePurpose({
            dynamoDBClient,
            purposeV2: msg.data.purpose,
            msgType: msg.type,
          });

        if (
          !existingPurposeEntry ||
          existingPurposeEntry.version > msg.version
        ) {
          // Stops processing if the message is older than the purpose entry or if it doesn't exist
          return Promise.resolve();
        } else {
          // platform-states
          await updatePurposeDataInPlatformStatesEntry({
            dynamoDBClient,
            primaryKey,
            purposeState,
            version: msg.version,
          });

          // token-generation-states
          await updatePurposeDataInTokenGenerationStatesTable({
            dynamoDBClient,
            purposeId: purpose.id,
            purposeState,
          });
        }
      }
    )
    .with({ type: "PurposeArchived" }, async (msg) => {
      const { purpose, primaryKey } = await parsePurpose({
        dynamoDBClient,
        purposeV2: msg.data.purpose,
        msgType: msg.type,
      });

      // platform-states
      await deletePlatformPurposeEntry(dynamoDBClient, primaryKey);

      // token-generation-states
      await updatePurposeDataInTokenGenerationStatesTable({
        dynamoDBClient,
        purposeId: purpose.id,
        purposeState: getPurposeStateFromPurposeVersions(purpose.versions),
      });
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

const parsePurpose = async ({
  dynamoDBClient,
  purposeV2,
  msgType,
  purposeVersionId,
}: {
  dynamoDBClient: DynamoDBClient;
  purposeV2: PurposeV2 | undefined;
  msgType: string;
  purposeVersionId?: string;
}): Promise<{
  purpose: Purpose;
  primaryKey: PlatformStatesPurposePK;
  purposeState: ItemState;
  existingPurposeEntry: PlatformStatesPurposeEntry | undefined;
  purposeVersionId?: PurposeVersionId;
}> => {
  if (!purposeV2) {
    throw missingKafkaMessageDataError("purpose", msgType);
  }
  const purpose = fromPurposeV2(purposeV2);
  const primaryKey = makePlatformStatesPurposePK(purpose.id);

  const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
  const existingPurposeEntry = await readPlatformPurposeEntry(
    dynamoDBClient,
    primaryKey
  );

  if (purposeVersionId) {
    return {
      purpose,
      primaryKey,
      purposeState,
      existingPurposeEntry,
      purposeVersionId: unsafeBrandId<PurposeVersionId>(purposeVersionId),
    };
  }
  return { purpose, primaryKey, purposeState, existingPurposeEntry };
};
