/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../utils/sqlQueryHelper.js";
import {
  generateMergeQuery,
  generateMergeDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import {
  PurposeVersionDeletingSchema,
  PurposeVersionSchema,
} from "../../model/purpose/purposeVersion.js";
import { DeletingDbTable, PurposeDbTable } from "../../model/db/index.js";
import {
  clean,
  cleanDeleting,
  mergeDeleting,
} from "../../utils/repositoryUtils.js";

export function purposeVersionRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose_version;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTableName = DeletingDbTable.purpose_deleting_table;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeVersionSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, PurposeVersionSchema);
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
      try {
        const mergeQuery = generateMergeQuery(
          PurposeVersionSchema,
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
      await clean(conn, stagingTableName);
    },

    async insertDeleting(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeVersionDeletingSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          deletingTableName,
          PurposeVersionDeletingSchema
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

export type PurposeVersionRepo = ReturnType<typeof purposeVersionRepo>;
