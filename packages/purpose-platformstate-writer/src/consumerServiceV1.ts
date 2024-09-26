import { match } from "ts-pattern";
import {
  fromPurposeV1,
  makePlatformStatesPurposePK,
  missingKafkaMessageDataError,
  PurposeEventEnvelopeV1,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  deletePlatformPurposeEntry,
  getPurposeStateFromPurposeVersions,
  updatePurposeDataInTokenGenerationStatesTable,
} from "./utils.js";

export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    // PurposeActivated, NewPurposeVersionActivated, PurposeVersionActivated, PurposeVersionUnsuspendedByConsumer, PurposeVersionUnsuspendedByProducer
    .with({ type: "PurposeVersionActivated" }, async (_msg) =>
      Promise.resolve()
    )
    // PurposeVersionSuspendedByConsumer, PurposeVersionSuspendedByProducer
    .with({ type: "PurposeVersionSuspended" }, async (_msg) =>
      Promise.resolve()
    )
    // PurposeArchived
    .with({ type: "PurposeVersionArchived" }, async (msg) => {
      const purposeV1 = msg.data.purpose;
      if (!purposeV1) {
        throw missingKafkaMessageDataError("purpose", msg.type);
      }
      const purpose = fromPurposeV1(purposeV1);
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
