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
import { Logger } from "pagopa-interop-commons";
import {
  deletePlatformPurposeEntry,
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
  updatePurposeDataInPlatformStatesEntry,
  getLastSuspendedOrActivatedPurposeVersion,
  updatePurposeDataInTokenGenStatesEntries,
  updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData,
  getLastArchivedPurposeVersion,
  upsertPlatformStatesPurposeEntry,
} from "./utils.js";

export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
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

      if (existingPurposeEntry && existingPurposeEntry.version > msg.version) {
        // Stops processing if the message is older than the purpose entry
        logger.info(
          `Skipping processing of entry ${existingPurposeEntry.PK}. Reason: a more recent entry already exists`
        );
        return Promise.resolve();
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
        await upsertPlatformStatesPurposeEntry(
          dynamoDBClient,
          purposeEntry,
          logger
        );

        // token-generation-states
        await updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData(
          dynamoDBClient,
          purpose,
          purposeState,
          purposeVersion.id,
          logger
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
        logger.info(
          `Skipping processing of entry ${primaryKey}. Reason: ${
            !existingPurposeEntry
              ? "entry not found in platform-states"
              : "a more recent entry already exists"
          }`
        );
        return Promise.resolve();
      } else {
        // platform-states
        await updatePurposeDataInPlatformStatesEntry({
          dynamoDBClient,
          primaryKey,
          purposeState,
          purposeVersionId: existingPurposeEntry.purposeVersionId,
          version: msg.version,
          logger,
        });

        // token-generation-states
        await updatePurposeDataInTokenGenStatesEntries({
          dynamoDBClient,
          purposeId: purpose.id,
          purposeState,
          purposeVersionId: existingPurposeEntry.purposeVersionId,
          purposeConsumerId: purpose.consumerId,
          logger,
        });
      }
    })
    .with({ type: "PurposeVersionArchived" }, async (msg) => {
      const purpose = parsePurpose(msg.data.purpose, msg.type);
      const primaryKey = makePlatformStatesPurposePK(purpose.id);

      // platform-states
      await deletePlatformPurposeEntry(dynamoDBClient, primaryKey, logger);

      // token-generation-states
      await updatePurposeDataInTokenGenStatesEntries({
        dynamoDBClient,
        purposeId: purpose.id,
        purposeState: getPurposeStateFromPurposeVersions(purpose.versions),
        purposeVersionId: getLastArchivedPurposeVersion(purpose.versions).id,
        purposeConsumerId: purpose.consumerId,
        logger,
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

const parsePurpose = (
  purposeV1: PurposeV1 | undefined,
  msgType: string
): Purpose => {
  if (!purposeV1) {
    throw missingKafkaMessageDataError("purpose", msgType);
  }
  return fromPurposeV1(purposeV1);
};
