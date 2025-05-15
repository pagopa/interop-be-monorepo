/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { PurposeVersionSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { DBContext } from "../../db/db.js";
import {
  generateMergeQuery,
  generateMergeDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { DeletingDbTable, PurposeDbTable } from "../../model/db.js";
import { PurposeVersionSchema } from "../../model/purpose/purposeVersion.js";

export function purposeVersionRepository(conn: DBContext["conn"]) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose_version;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.purpose_deleting_table;

  return {
    async insert(t: ITask<unknown>, pgp: IMain, records: PurposeVersionSQL[]) {
      const mapping = {
        id: (r: PurposeVersionSQL) => r.id,
        purpose_id: (r: PurposeVersionSQL) => r.purposeId,
        metadata_version: (r: PurposeVersionSQL) => r.metadataVersion,
        state: (r: PurposeVersionSQL) => r.state,
        daily_calls: (r: PurposeVersionSQL) => r.dailyCalls,
        rejection_reason: (r: PurposeVersionSQL) => r.rejectionReason,
        created_at: (r: PurposeVersionSQL) => r.createdAt,
        updated_at: (r: PurposeVersionSQL) => r.updatedAt,
        first_activation_at: (r: PurposeVersionSQL) => r.firstActivationAt,
        suspended_at: (r: PurposeVersionSQL) => r.suspendedAt,
      };
      const cs = buildColumnSet<PurposeVersionSQL>(pgp, mapping, stagingTable);
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(
            `DELETE FROM ${stagingTable} a
             USING ${stagingTable} b
             WHERE a.id = b.id
               AND a.metadata_version < b.metadata_version;`
          );
        }
      } catch (e) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${e}`
        );
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            PurposeVersionSchema,
            schemaName,
            tableName,
            stagingTable,
            ["id"]
          )
        );
      } catch (error) {
        throw genericInternalError(
          `Error merging staging table ${stagingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (error) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTable}: ${error}`
        );
      }
    },

    async insertDeleting(t: ITask<unknown>, pgp: IMain, recordsId: string[]) {
      const mapping = {
        id: (r: { id: string }) => r.id,
        deleted: () => true,
      };
      const cs = buildColumnSet<{ id: string; deleted: boolean }>(
        pgp,
        mapping,
        stagingDeletingTable
      );
      try {
        const recs = recordsId.map((id) => ({ id, deleted: true }));
        await t.none(pgp.helpers.insert(recs, cs) + " ON CONFLICT DO NOTHING");
      } catch (e) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTable}: ${e}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>) {
      try {
        const q = generateMergeDeleteQuery(
          schemaName,
          tableName,
          stagingDeletingTable,
          ["id"]
        );
        await t.none(q);
      } catch (e) {
        throw genericInternalError(
          `Error merging deletions into ${schemaName}.${tableName}: ${e}`
        );
      }
    },

    async cleanDeleting() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTable};`);
      } catch (e) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingDeletingTable}: ${e}`
        );
      }
    },
  };
}
