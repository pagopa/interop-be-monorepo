/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { PurposeDbTable } from "../../model/db/index.js";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { PurposeVersionStampSchema } from "../../model/purpose/purposeVersionStamp.js";

export function purposeVersionStampRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose_version_stamp;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeVersionStampSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, PurposeVersionStampSchema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(tableName, ["purposeVersionId", "kind"])
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          PurposeVersionStampSchema,
          schemaName,
          tableName,
          ["purposeVersionId", "kind"]
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
