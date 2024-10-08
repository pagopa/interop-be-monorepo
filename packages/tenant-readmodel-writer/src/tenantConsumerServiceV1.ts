import { match } from "ts-pattern";
import { TenantCollection } from "pagopa-interop-commons";
import {
  TenantEventEnvelopeV1,
  fromTenantV1,
  toReadModelTenant,
} from "pagopa-interop-models";

export async function handleMessageV1(
  message: TenantEventEnvelopeV1,
  tenants: TenantCollection
): Promise<void> {
  await match(message)
    .with({ type: "TenantCreated" }, async (msg) => {
      await tenants.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.tenant
              ? toReadModelTenant(fromTenantV1(msg.data.tenant))
              : undefined,
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
        "metadata.version": { $lte: msg.version },
      });
    })
    .with(
      { type: "TenantUpdated" },
      async (msg) =>
        await tenants.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lte: msg.version },
          },
          {
            $set: {
              data: msg.data.tenant
                ? toReadModelTenant(fromTenantV1(msg.data.tenant))
                : undefined,
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
          "metadata.version": { $lte: msg.version },
        },
        {
          $set: {
            "data.selfcareId": msg.data.selfcareId,
            "metadata.version": msg.version,
          },
        }
      );
    })
    .with({ type: "SelfcareMappingDeleted" }, async () => Promise.resolve())
    .with({ type: "TenantMailAdded" }, async (msg) => {
      await tenants.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lte: msg.version },
        },
        {
          $set: {
            data: msg.data.tenant
              ? toReadModelTenant(fromTenantV1(msg.data.tenant))
              : undefined,
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
          "metadata.version": { $lte: msg.version },
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
