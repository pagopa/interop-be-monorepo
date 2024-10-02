import { match } from "ts-pattern";
import {
  fromPurposeV1,
  itemState,
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
  updatePurposeDataInTokenGenerationStatesTable,
  readPlatformPurposeEntry,
  updatePurposeDataInPlatformStatesEntry,
  writePlatformPurposeEntry,
  updatePurposeEntriesInTokenGenerationStatesTable,
} from "./utils.js";

export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    // PurposeActivated
    // NewPurposeVersionActivated, PurposeVersionActivated,
    // PurposeVersionUnsuspendedByConsumer, PurposeVersionUnsuspendedByProducer
    /*
    PurposeActivated(purpose): draft ->
    PurposeVersionActivated: waiting for approval -> 
    ...UnsuspendedBy...: suspended ->
    */
    .with({ type: "PurposeVersionActivated" }, async (msg) => {
      const purpose = parsePurpose(msg.data.purpose, msg.type);
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
      const primaryKey = makePlatformStatesPurposePK(purpose.id);
      const existingPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );
      const purposeVersion = purpose.versions
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (existingPurposeEntry && existingPurposeEntry.version > msg.version) {
        // Stops processing if the message is older than the purpose entry
        return Promise.resolve();
      } else if (
        existingPurposeEntry &&
        existingPurposeEntry.version <= msg.version
      ) {
        if (existingPurposeEntry.state === itemState.inactive) {
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
        } else {
          // platform-states
          await updatePurposeDataInPlatformStatesEntry({
            dynamoDBClient,
            primaryKey,
            purposeState: getPurposeStateFromPurposeVersions(purpose.versions),
            version: msg.version,
            purposeVersionId: purposeVersion.id,
          });

          // token-generation-states
          await updatePurposeDataInTokenGenerationStatesTable({
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
          purposeVersionId: purpose.versions[0].id, // always length == 1
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await writePlatformPurposeEntry(dynamoDBClient, purposeEntry);

        // token-generation-states
        await updatePurposeEntriesInTokenGenerationStatesTable(
          dynamoDBClient,
          purpose,
          purposeState,
          purpose.versions[0].id
        );
      }
    })
    // PurposeVersionSuspendedByConsumer, PurposeVersionSuspendedByProducer
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
          version: msg.version,
        });

        // token-generation-states
        await updatePurposeDataInTokenGenerationStatesTable({
          dynamoDBClient,
          purposeId: purpose.id,
          purposeState,
        });
      }
    })
    // PurposeArchived
    .with({ type: "PurposeVersionArchived" }, async (msg) => {
      const purpose = parsePurpose(msg.data.purpose, msg.type);
      const primaryKey = makePlatformStatesPurposePK(purpose.id);

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
