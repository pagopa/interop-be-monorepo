/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";

import { DBConnection } from "../../db/db.js";
import {
  generateMergeQuery,
  generateMergeDeleteQuery,
  buildColumnSet,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  PurposeSchema,
  PurposeDeletingSchema,
} from "../../model/purpose/purpose.js";
import { DeletingDbTable } from "../../model/db/deleting.js";
import { PurposeDbTable } from "../../model/db/index.js";
import {
  clean,
  cleanDeleting,
  merge,
  mergeDeleting,
} from "../../utils/repositoryUtils.js";

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
        await t.none(`
          DELETE FROM ${stagingTableName} a
          USING ${stagingTableName} b
          WHERE a.id = b.id AND a.metadata_version < b.metadata_version;
        `);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      const mergeQuery = generateMergeQuery(
        PurposeSchema,
        schemaName,
        tableName,
        ["id"]
      );

      await merge({ t, mergeQuery, stagingTableName, schemaName, tableName });
    },

    async clean(): Promise<void> {
      await clean(conn, stagingTableName);
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
        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${stagingDeletingTableName}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      const mergeQuery = generateMergeDeleteQuery(
        schemaName,
        tableName,
        deletingTableName,
        ["id"]
      );

      await mergeDeleting({
        t,
        mergeQuery,
        stagingDeletingTableName,
        schemaName,
        tableName,
      });
    },

    async cleanDeleting(): Promise<void> {
      await cleanDeleting(conn, stagingDeletingTableName);
    },
  };
}

export type PurposeRepo = ReturnType<typeof purposeRepo>;
