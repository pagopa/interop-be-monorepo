/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  DescriptorServerUrlsSchema,
  EserviceDescriptorDeletingSchema,
  EserviceDescriptorSchema,
} from "../../model/catalog/eserviceDescriptor.js";
import {
  CatalogDbPartialTable,
  CatalogDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";

export function eserviceDescriptorRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor;
  const descriptorServerUrlsTableName =
    CatalogDbPartialTable.descriptor_server_urls;
  const stagingDescriptorServerUrlsTableName = `${CatalogDbPartialTable.descriptor_server_urls}_${config.mergeTableSuffix}`;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTableName = DeletingDbTable.catalog_deleting_table;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EserviceDescriptorSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, EserviceDescriptorSchema);

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
          EserviceDescriptorSchema,
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
      records: EserviceDescriptorDeletingSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          deletingTableName,
          EserviceDescriptorDeletingSchema
        );
        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTableName}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          deletingTableName,
          ["id"]
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
    async insertServerUrls(
      t: ITask<unknown>,
      pgp: IMain,
      records: DescriptorServerUrlsSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          descriptorServerUrlsTableName,
          DescriptorServerUrlsSchema
        );

        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingDescriptorServerUrlsTableName} a
          USING ${stagingDescriptorServerUrlsTableName} b
          WHERE a.id = b.id
          AND a.metadata_version < b.metadata_version;
        `);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDescriptorServerUrlsTableName}: ${error}`
        );
      }
    },
    async mergeServerUrls(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          DescriptorServerUrlsSchema,
          schemaName,
          tableName,
          ["id"],
          descriptorServerUrlsTableName
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingDescriptorServerUrlsTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },
    async cleanServerUrls(): Promise<void> {
      try {
        await conn.none(
          `TRUNCATE TABLE ${stagingDescriptorServerUrlsTableName};`
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning deleting staging table ${stagingDescriptorServerUrlsTableName}: ${error}`
        );
      }
    },
  };
}

export type EserviceDescriptorRepository = ReturnType<
  typeof eserviceDescriptorRepository
>;
