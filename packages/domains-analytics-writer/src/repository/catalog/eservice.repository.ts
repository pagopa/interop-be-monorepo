/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceMapping,
  eserviceDeletingSchema,
  eserviceSchema,
} from "../../model/catalog/eservice.js";
import { CatalogDbTable } from "../../model/db.js";

export function eserviceRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice;
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;
  const stagingDeletingTable = CatalogDbTable.deleting_by_id_table;

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
        is_signal_hub_enabled: (r: EServiceSQL) =>
          r.isSignalHubEnabled ? "true" : "false",
        is_consumer_delegable: (r: EServiceSQL) =>
          r.isConsumerDelegable ? "true" : "false",
        is_client_access_delegable: (r: EServiceSQL) =>
          r.isClientAccessDelegable ? "true" : "false",
      };
      const cs = buildColumnSet<EServiceSQL>(pgp, mapping, stagingTable);
      try {
        await t.none(pgp.helpers.insert(records, cs));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          eserviceSchema,
          schemaName,
          tableName,
          `${tableName}${config.mergeTableSuffix}`,
          "id"
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          eserviceDeletingSchema,
          schemaName,
          tableName,
          stagingDeletingTable,
          "id",
          true
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingDeletingTable} into ${schemaName}.${tableName}: ${error}`
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

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
    async insertDeletingByEserviceId(
      t: ITask<unknown>,
      pgp: IMain,
      id: string
    ): Promise<void> {
      const mapping = {
        id: () => id,
        deleted: () => true,
      };
      try {
        const cs = buildColumnSet<{ id: string; deleted: boolean }>(
          pgp,
          mapping,
          stagingDeletingTable
        );

        await t.none(
          pgp.helpers.insert({ id, deleted: true }, cs) +
            " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}

export type EserviceRepository = ReturnType<typeof eserviceRepository>;
