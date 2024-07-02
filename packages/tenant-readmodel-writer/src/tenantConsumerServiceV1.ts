import { match } from "ts-pattern";
import {
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import { TenantEventEnvelopeV1, fromTenantV1 } from "pagopa-interop-models";

const { tenants } = ReadModelRepository.init(readModelWriterConfig());

export async function handleMessageV1(
  message: TenantEventEnvelopeV1
): Promise<void> {
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
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    .with({ type: "TenantDeleted" }, async (_msg) => {})
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
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    .with({ type: "SelfcareMappingCreated" }, async (_msg) => {})
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    .with({ type: "SelfcareMappingDeleted" }, async (_msg) => {})
    .exhaustive();
}
