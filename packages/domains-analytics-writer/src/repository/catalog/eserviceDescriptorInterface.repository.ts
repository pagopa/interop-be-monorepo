/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceDescriptorInterfaceSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet, Mapping } from "../../db/buildColumnSet.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { EserviceDescriptorInterfaceSchema } from "../../model/catalog/eserviceDescriptorInterface.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db.js";

export function eserviceDescriptorInterfaceRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor_interface;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTable = DeletingDbTable.catalog_deleting_table;
  const stagingDeletingTable = `${deletingTable}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorInterfaceSQL[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName);
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
          EserviceDescriptorInterfaceSchema,
          schemaName,
          tableName,
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
      recordsId: Array<EServiceDescriptorInterfaceSQL["id"]>
    ): Promise<void> {
      try {
        const mapping: Partial<Mapping<typeof deletingTable>> = {
          deleted: () => true,
        };
        const cs = buildColumnSet(pgp, deletingTable, mapping);
        const records = recordsId.map((id) => ({ id }));
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
          deletingTable,
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
          `Error cleaning deleting staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}

export type EserviceDescriptorInterfaceRepository = ReturnType<
  typeof eserviceDescriptorInterfaceRepository
>;
