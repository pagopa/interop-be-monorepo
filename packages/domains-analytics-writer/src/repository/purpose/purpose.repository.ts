/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { PurposeSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { DBContext } from "../../db/db.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { DeletingDbTable, PurposeDbTable } from "../../model/db.js";
import { PurposeMapping, PurposeSchema } from "../../model/purpose/purpose.js";

export function purposeRepository(conn: DBContext["conn"]) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.purpose_deleting_table;

  return {
    async insert(t: ITask<unknown>, pgp: IMain, records: PurposeSQL[]) {
      const mapping: PurposeMapping = {
        id: (r: PurposeSQL) => r.id,
        metadata_version: (r: PurposeSQL) => r.metadataVersion,
        eservice_id: (r: PurposeSQL) => r.eserviceId,
        consumer_id: (r: PurposeSQL) => r.consumerId,
        delegation_id: (r: PurposeSQL) => r.delegationId,
        suspended_by_consumer: (r: PurposeSQL) => r.suspendedByConsumer,
        suspended_by_producer: (r: PurposeSQL) => r.suspendedByProducer,
        title: (r: PurposeSQL) => r.title,
        description: (r: PurposeSQL) => r.description,
        created_at: (r: PurposeSQL) => r.createdAt,
        updated_at: (r: PurposeSQL) => r.updatedAt,
        is_free_of_charge: (r: PurposeSQL) => r.isFreeOfCharge,
        free_of_charge_reason: (r: PurposeSQL) => r.freeOfChargeReason,
      };
      const cs = buildColumnSet<PurposeSQL>(pgp, mapping, stagingTable);
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(`
              DELETE FROM ${stagingTable} a
              USING ${stagingTable} b
              WHERE a.id = b.id
              AND a.metadata_version < b.metadata_version;
            `);
        }
      } catch (error) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            PurposeSchema,
            schemaName,
            tableName,
            `${tableName}_${config.mergeTableSuffix}`,
            ["id"]
          )
        );
      } catch (e) {
        throw genericInternalError(`merge purpose: ${e}`);
      }
    },

    async clean() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (e) {
        throw genericInternalError(`clean purpose stagingTable: ${e}`);
      }
    },
    async insertDeleting(
      t: ITask<unknown>,
      pgp: IMain,
      recordsId: Array<PurposeSQL["id"]>
    ): Promise<void> {
      try {
        const mapping = {
          id: (r: { id: string }) => r.id,
          deleted: () => true,
        };

        const cs = buildColumnSet<{ id: string; deleted: boolean }>(
          pgp,
          mapping,
          stagingDeletingTable
        );

        const records = recordsId.map((id: string) => ({ id, deleted: true }));

        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          stagingDeletingTable,
          ["id"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingDeletingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}
