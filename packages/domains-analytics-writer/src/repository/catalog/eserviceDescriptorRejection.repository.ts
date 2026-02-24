/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { EserviceDescriptorRejectionReasonSchema } from "../../model/catalog/eserviceDescriptorRejection.js";
import { CatalogDbTable } from "../../model/db/index.js";

export function eserviceDescriptorRejectionRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor_rejection_reason;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EserviceDescriptorRejectionReasonSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tableName,
          EserviceDescriptorRejectionReasonSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(generateStagingDeleteQuery(tableName, ["descriptorId"]));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          EserviceDescriptorRejectionReasonSchema,
          schemaName,
          tableName,
          ["descriptorId"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTableName}: ${error}`
        );
      }
    },
  };
}
