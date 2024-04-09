import { PurposeCollection } from "pagopa-interop-commons";
import {
  PurposeEventEnvelopeV1,
  fromPurposeV1,
  fromPurposeVersionV1,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

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
            $setOnInsert: {
              data: msg.data.purpose
                ? fromPurposeV1(msg.data.purpose)
                : undefined,
              metadata: { version: msg.version },
            },
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
              "data.versions": msg.data.version
                ? fromPurposeVersionV1(msg.data.version)
                : undefined,
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
            $setOnInsert: {
              data: msg.data.purpose
                ? fromPurposeV1(msg.data.purpose)
                : undefined,
              metadata: { version: msg.version },
            },
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
            "data.versions.$[version]": msg.data.version
              ? fromPurposeVersionV1(msg.data.version)
              : undefined,
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
