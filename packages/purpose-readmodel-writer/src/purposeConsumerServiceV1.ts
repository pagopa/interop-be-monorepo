import { PurposeCollection } from "pagopa-interop-commons";
import {
  PurposeEventEnvelopeV1,
  PurposeReadModel,
  PurposeV1,
  PurposeVersionReadModel,
  PurposeVersionV1,
  fromPurposeV1,
  fromPurposeVersionV1,
  toReadModelPurpose,
  toReadModelPurposeVersion,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

const adaptPurposeToReadModel = (
  version: number,
  purpose?: PurposeV1
): { data: PurposeReadModel | undefined; metadata: { version: number } } => ({
  data: purpose ? toReadModelPurpose(fromPurposeV1(purpose)) : undefined,
  metadata: {
    version,
  },
});

const adaptPurposeVersionToReadModel = (
  purposeVersion?: PurposeVersionV1
): PurposeVersionReadModel | undefined =>
  purposeVersion
    ? toReadModelPurposeVersion(fromPurposeVersionV1(purposeVersion))
    : undefined;

export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  purposes: PurposeCollection
): Promise<void> {
  await match(message)
    .with(
      { type: "PurposeCreated" },
      async (msg) =>
        await purposes.updateOne(
          { "data.id": msg.stream_id },
          {
            $setOnInsert: adaptPurposeToReadModel(
              msg.version,
              msg.data.purpose
            ),
          },
          { upsert: true }
        )
    )
    .with(
      { type: "PurposeVersionCreated" },
      async (msg) =>
        await purposes.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              "metadata.version": msg.version,
            },
            $push: {
              "data.versions": adaptPurposeVersionToReadModel(msg.data.version),
            },
          }
        )
    )
    .with(
      { type: "PurposeUpdated" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeVersionSuspended" },
      { type: "PurposeVersionArchived" },
      { type: "PurposeVersionWaitedForApproval" },
      { type: "PurposeVersionRejected" },
      async (msg) =>
        await purposes.updateOne(
          { "data.id": msg.stream_id },
          {
            $set: adaptPurposeToReadModel(msg.version, msg.data.purpose),
          }
        )
    )
    .with({ type: "PurposeVersionUpdated" }, async (msg) => {
      await purposes.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $set: {
            "metadata.version": msg.version,
            "data.versions.$[version]": adaptPurposeVersionToReadModel(
              msg.data.version
            ),
          },
        },
        {
          arrayFilters: [
            {
              "version.id": msg.data.version?.id,
            },
          ],
        }
      );
    })
    .with({ type: "PurposeDeleted" }, async (msg) => {
      await purposes.deleteOne({
        "data.id": msg.stream_id,
        "metadata.version": { $lt: msg.version },
      });
    })
    .with(
      { type: "PurposeVersionDeleted" },
      async (msg) =>
        await purposes.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $pull: {
              "data.versions": {
                id: msg.data.versionId,
              },
            },
            $set: {
              "metadata.version": msg.version,
            },
          }
        )
    )
    .exhaustive();
}
