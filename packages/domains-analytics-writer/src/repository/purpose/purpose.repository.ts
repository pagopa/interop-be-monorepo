/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";

import { DBConnection } from "../../db/db.js";
import {
  generateMergeQuery,
  generateMergeDeleteQuery,
  buildColumnSet,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  PurposeSchema,
  PurposeDeletingSchema,
} from "../../model/purpose/purpose.js";
import { DeletingDbTable } from "../../model/db/deleting.js";
import { PurposeDbTable } from "../../model/db/index.js";

export function purposeRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTableName = DeletingDbTable.purpose_deleting_table;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, PurposeSchema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(generateStagingDeleteQuery(tableName, ["id"]));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          PurposeSchema,
          schemaName,
          tableName,
          ["id"]
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

    async insertDeleting(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeDeletingSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          deletingTableName,
          PurposeDeletingSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${stagingDeletingTableName}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          deletingTableName,
          ["id"],
          true,
          false
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingDeletingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning deleting staging table ${stagingDeletingTableName}: ${error}`
        );
      }
    },
  };
}
