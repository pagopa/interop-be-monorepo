import { match } from "ts-pattern";
import {
  ReadModelRepository,
  consumerConfig,
  logger,
} from "pagopa-interop-commons";
import { EventEnvelope } from "./model/models.js";
import { fromTenantV1 } from "./model/converter.js";

const { tenants } = ReadModelRepository.init(consumerConfig());

export async function handleMessage(message: EventEnvelope): Promise<void> {
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
