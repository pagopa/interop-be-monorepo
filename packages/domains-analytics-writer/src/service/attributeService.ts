/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericLogger } from "pagopa-interop-commons";
import { AttributeSQL } from "pagopa-interop-readmodel-models";
import { DBContext } from "../db/db.js";
import { batchMessages } from "../utils/batchHelper.js";
import { attributeRepository } from "../repository/attribute/attribute.repository.js";
import { config } from "../config/config.js";

export function attributeServiceBuilder(db: DBContext) {
  const repo = attributeRepository(db.conn);

  return {
    async upsertBatchAttribute(
      upsertBatch: AttributeSQL[],
      dbContext: DBContext
    ): Promise<void> {
      for (const batch of batchMessages(
        upsertBatch,
        config.dbMessagesToInsertPerBatch
      )) {
        await dbContext.conn.tx(async (t) => {
          await repo.insert(t, dbContext.pgp, batch);
        });
        genericLogger.info(
          `Staging data inserted for batch of attributes: ${batch
            .map((r) => r.id)
            .join(", ")}`
        );
      }

      await dbContext.conn.tx(async (t) => {
        await repo.merge(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for all attribute batches`
      );
      await repo.clean();
    },

    async deleteBatchAttribute(
      attributeIds: string[],
      dbContext: DBContext
    ): Promise<void> {
      for (const batch of batchMessages(
        attributeIds,
        config.dbMessagesToInsertPerBatch
      )) {
        await dbContext.conn.tx(async (t) => {
          for (const id of batch) {
            await repo.insertDeletingById(t, dbContext.pgp, id);
          }
          genericLogger.info(
            `Staging deletion inserted for attributeIds: ${batch.join(", ")}`
          );
        });
      }

      await dbContext.conn.tx(async (t) => {
        await repo.mergeDeleting(t);
      });

      genericLogger.info(
        `Staging deletion merged into target table for all attributeIds`
      );
      await repo.cleanDeleting();
    },
  };
}

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;
