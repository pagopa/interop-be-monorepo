import { match } from "ts-pattern";
import {
  fromPurposeV1,
  makePlatformStatesPurposePK,
  missingKafkaMessageDataError,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeEventEnvelopeV1,
  PurposeV1,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  deletePlatformPurposeEntry,
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
  updatePurposeDataInPlatformStatesEntry,
  writePlatformPurposeEntry,
  getLastSuspendedOrActivatedPurposeVersion,
  updatePurposeDataInTokenEntries,
  updateTokenEntriesWithPurposeAndPlatformStatesData,
  getLastArchivedPurposeVersion,
} from "./utils.js";

export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "PurposeVersionActivated" }, async (msg) => {
      const purpose = parsePurpose(msg.data.purpose, msg.type);
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
      const primaryKey = makePlatformStatesPurposePK(purpose.id);
      const existingPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );
      const purposeVersion = getLastSuspendedOrActivatedPurposeVersion(
        purpose.versions
      );

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
            purposeVersionId: purposeVersion.id,
          });

          // token-generation-states
          await updatePurposeDataInTokenEntries({
            dynamoDBClient,
            purposeId: purpose.id,
            purposeState,
            purposeVersionId: purposeVersion.id,
          });
        }
      } else {
        // platform-states
        const purposeEntry: PlatformStatesPurposeEntry = {
          PK: primaryKey,
          state: purposeState,
          purposeVersionId: purposeVersion.id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await writePlatformPurposeEntry(dynamoDBClient, purposeEntry);

        // token-generation-states
        await updateTokenEntriesWithPurposeAndPlatformStatesData(
          dynamoDBClient,
          purpose,
          purposeState,
          purposeVersion.id
        );
      }
    })
    .with({ type: "PurposeVersionSuspended" }, async (msg) => {
      const purpose = parsePurpose(msg.data.purpose, msg.type);
      const primaryKey = makePlatformStatesPurposePK(purpose.id);
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
      const existingPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );

      if (!existingPurposeEntry || existingPurposeEntry.version > msg.version) {
        // Stops processing if the message is older than the purpose entry or if it doesn't exist
        return Promise.resolve();
      } else {
        // platform-states
        await updatePurposeDataInPlatformStatesEntry({
          dynamoDBClient,
          primaryKey,
          purposeState,
          purposeVersionId: existingPurposeEntry.purposeVersionId,
          version: msg.version,
        });

        // token-generation-states
        await updatePurposeDataInTokenEntries({
          dynamoDBClient,
          purposeId: purpose.id,
          purposeState,
          purposeVersionId: existingPurposeEntry.purposeVersionId,
        });
      }
    })
    .with({ type: "PurposeVersionArchived" }, async (msg) => {
      const purpose = parsePurpose(msg.data.purpose, msg.type);
      const primaryKey = makePlatformStatesPurposePK(purpose.id);

      // platform-states
      await deletePlatformPurposeEntry(dynamoDBClient, primaryKey);

      // token-generation-states
      await updatePurposeDataInTokenEntries({
        dynamoDBClient,
        purposeId: purpose.id,
        purposeState: getPurposeStateFromPurposeVersions(purpose.versions),
        purposeVersionId: getLastArchivedPurposeVersion(purpose.versions).id,
      });
    })
    .with(
      { type: "PurposeCreated" },
      { type: "PurposeVersionCreated" },
      { type: "PurposeUpdated" },
      { type: "PurposeVersionWaitedForApproval" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeVersionUpdated" },
      { type: "PurposeDeleted" },
      { type: "PurposeVersionDeleted" },
      () => Promise.resolve()
    )
    .exhaustive();
}

export const parsePurpose = (
  purposeV1: PurposeV1 | undefined,
  msgType: string
): Purpose => {
  if (!purposeV1) {
    throw missingKafkaMessageDataError("purpose", msgType);
  }
  return fromPurposeV1(purposeV1);
};