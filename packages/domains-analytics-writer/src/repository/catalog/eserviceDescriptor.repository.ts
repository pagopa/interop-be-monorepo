/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateStagingDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { EserviceDescriptorSchema } from "pagopa-interop-kpi-models";
import {
  EserviceDescriptorServerUrlsSchema,
  EserviceDescriptorDeletingSchema,
} from "../../model/catalog/eserviceDescriptor.js";
import {
  CatalogDbPartialTable,
  CatalogDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export function eserviceDescriptorRepository(conn: DBConnection) {
  const base = createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor,
    schema: EserviceDescriptorSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.catalog_deleting_table,
      deletingSchema: EserviceDescriptorDeletingSchema,
    },
  });

  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor;
  const descriptorServerUrlsTableName =
    CatalogDbPartialTable.descriptor_server_urls;
  const stagingDescriptorServerUrlsTableName = `${descriptorServerUrlsTableName}_${config.mergeTableSuffix}`;

  return {
    ...base,

    async insertServerUrls(
      t: ITask<unknown>,
      pgp: IMain,
      records: EserviceDescriptorServerUrlsSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          descriptorServerUrlsTableName,
          EserviceDescriptorServerUrlsSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(
            tableName,
            ["id"],
            descriptorServerUrlsTableName
          )
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDescriptorServerUrlsTableName}: ${error}`
        );
      }
    },

    async mergeServerUrls(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          EserviceDescriptorServerUrlsSchema,
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
