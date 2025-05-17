/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceSQL } from "pagopa-interop-readmodel-models";
import { IMain, ITask } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceMapping,
  EserviceSchema,
} from "../../model/catalog/eservice.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db.js";

export function eserviceRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.catalog_deleting_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceSQL[]
    ): Promise<void> {
      const mapping: EserviceMapping = {
        id: (r: EServiceSQL) => r.id,
        metadata_version: (r: EServiceSQL) => r.metadataVersion,
        name: (r: EServiceSQL) => r.name,
        producer_id: (r: EServiceSQL) => r.producerId,
        created_at: (r: EServiceSQL) => r.createdAt,
        description: (r: EServiceSQL) => r.description,
        technology: (r: EServiceSQL) => r.technology,
        mode: (r: EServiceSQL) => r.mode,
        is_signal_hub_enabled: (r: EServiceSQL) => r.isSignalHubEnabled,
        is_consumer_delegable: (r: EServiceSQL) => r.isConsumerDelegable,
        is_client_access_delegable: (r: EServiceSQL) =>
          r.isClientAccessDelegable,
      };
      const cs = buildColumnSet<EServiceSQL>(pgp, mapping, stagingTable);
      try {
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
        DELETE FROM ${stagingTable} a
        USING ${stagingTable} b
        WHERE a.id = b.id
        AND a.metadata_version < b.metadata_version;
      `);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          EserviceSchema,
          schemaName,
          tableName,
          stagingTable,
          ["id"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTable}: ${error}`
        );
      }
    },

    async insertDeleting(
      t: ITask<unknown>,
      pgp: IMain,
      recordsId: Array<EServiceSQL["id"]>
    ): Promise<void> {
      try {
        const mapping = {
          id: (r: { id: string }) => r.id,
          deleted: () => true,
        };

        const cs = buildColumnSet<{ id: string; deleted: boolean }>(
          pgp,
          mapping,
          `${stagingDeletingTable}_${config.mergeTableSuffix}`
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
        await conn.none(
          `TRUNCATE TABLE ${stagingDeletingTable}_${config.mergeTableSuffix};`
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}

export type EserviceRepository = ReturnType<typeof eserviceRepository>;
