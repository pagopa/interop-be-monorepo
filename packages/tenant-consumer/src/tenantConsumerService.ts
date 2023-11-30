import { match } from "ts-pattern";
import { logger } from "pagopa-interop-commons";
import { EventEnvelope } from "./model/models.js";

export async function handleMessage(message: EventEnvelope): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "TenantCreated" }, async (_msg) => {
      logger.info("TODO");
    })
    .with({ type: "TenantDeleted" }, async (_msg) => {
      logger.info("TODO");
    })
    .with({ type: "TenantUpdated" }, async (_msg) => {
      logger.info("TODO");
    })
    .with({ type: "SelfcareMappingCreated" }, async (_msg) => {
      logger.info("TODO");
    })
    .with({ type: "SelfcareMappingDeleted" }, async (_msg) => {
      logger.info("TODO");
    })
    .exhaustive();
}
