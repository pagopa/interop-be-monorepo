import { match } from "ts-pattern";
import {
  ReadModelRepository,
  readModelWriterConfig,
  logger,
} from "pagopa-interop-commons";
import { TenantEventEnvelope, fromTenantV1 } from "pagopa-interop-models";
import { bigIntReplacer } from "../../commons/src/logging/utils.js";

const { tenants } = ReadModelRepository.init(readModelWriterConfig());

export async function handleMessage(
  message: TenantEventEnvelope
): Promise<void> {
  logger.info(JSON.stringify(message, bigIntReplacer));
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
    .with({ type: "TenantDeleted" }, async (_msg) => {
      logger.info("TODO");
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
    .with({ type: "SelfcareMappingCreated" }, async (_msg) => {
      logger.info("TODO");
    })
    .with({ type: "SelfcareMappingDeleted" }, async (_msg) => {
      logger.info("TODO");
    })
    .exhaustive();
}
