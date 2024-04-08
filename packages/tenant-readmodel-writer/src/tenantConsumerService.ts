import { match } from "ts-pattern";
import {
  ReadModelRepository,
  readModelWriterConfig,
  logger,
} from "pagopa-interop-commons";
import { TenantEventEnvelopeV1, fromTenantV1 } from "pagopa-interop-models";

const { tenants } = ReadModelRepository.init(readModelWriterConfig());

export async function handleMessage(
  message: TenantEventEnvelopeV1
): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "TenantCreated" }, async (msg) => {
      await tenants.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.tenant ? fromTenantV1(msg.data.tenant) : undefined,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "TenantDeleted" }, async (msg) => {
      await tenants.deleteOne({
        "data.id": msg.stream_id,
        "metadata.version": { $lt: msg.version },
      });
    })
    .with(
      { type: "TenantUpdated" },
      async (msg) =>
        await tenants.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              data: msg.data.tenant ? fromTenantV1(msg.data.tenant) : undefined,
              metadata: {
                version: msg.version,
              },
            },
          }
        )
    )
    .with({ type: "SelfcareMappingCreated" }, async (msg) => {
      await tenants.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $set: {
            "data.selfcareId": msg.data.selfcareId,
            "metadata.version": msg.version,
          },
        }
      );
    })
    .with({ type: "SelfcareMappingDeleted" }, async (msg) => {
      await tenants.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $set: {
            "data.selfcareId": undefined,
            "metadata.version": msg.version,
          },
        }
      );
    })
    .with({ type: "TenantMailAdded" }, async (msg) => {
      await tenants.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $set: {
            data: msg.data.tenant ? fromTenantV1(msg.data.tenant) : undefined,
            metadata: {
              version: msg.version,
            },
          },
        }
      );
    })
    .with({ type: "TenantMailDeleted" }, async (msg) => {
      await tenants.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $pull: {
            "data.mails": {
              id: msg.data.mailId,
            },
          },
          $set: {
            metadata: {
              version: msg.version,
            },
          },
        }
      );
    })
    .exhaustive();
}
