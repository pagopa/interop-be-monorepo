/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericLogger } from "pagopa-interop-commons";
import { DBContext } from "../db/db.js";
import { batchMessages } from "../utils/batchHelper.js";
import { attributeRepository } from "../repository/attribute/attribute.repository.js";
import { config } from "../config/config.js";
import {
  AttributeSchema,
  AttributeDeletingSchema,
} from "../model/attribute/attribute.js";
import { AttributeDbTable } from "../model/db/attribute.js";
import { cleaningTargetTables } from "../utils/sqlQueryHelper.js";

export function attributeServiceBuilder(db: DBContext) {
  const repo = attributeRepository(db.conn);

  return {
    async upsertBatchAttribute(
      dbContext: DBContext,
      items: AttributeSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await repo.insert(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging data inserted for batch of attributes: ${batch
              .map((r) => r.id)
              .join(", ")}`
          );
        }
        await repo.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "id",
          [AttributeDbTable.attribute],
          AttributeDbTable.attribute
        );
      });

      genericLogger.info(
        `Staging data merged into target tables for all attribute batches`
      );
      await repo.clean();
    },

    async deleteBatchAttribute(
      dbContext: DBContext,
      items: AttributeDeletingSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await repo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for attributeIds: ${batch
              .map((r) => r.id)
              .join(", ")}`
          );
        }

        await repo.mergeDeleting(t);
      });

      genericLogger.info(
        `Staging deletion merged into target table for all attributeIds`
      );
      await repo.cleanDeleting();
    },
  };
}
