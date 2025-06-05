/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { EserviceTemplateVersionInterfaceSchema } from "../../model/eserviceTemplate/eserviceTemplateVersionInterface.js";

export function eserviceTemplateVersionInterfaceRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = EserviceTemplateDbTable.eservice_template_version_interface;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EserviceTemplateVersionInterfaceSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tableName,
          EserviceTemplateVersionInterfaceSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTableName} a
          USING ${stagingTableName} b
          WHERE a.id = b.id
            AND a.metadata_version < b.metadata_version;
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
          EserviceTemplateVersionInterfaceSchema,
          schemaName,
          tableName,
          ["id"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging into ${schemaName}.${tableName}: ${error}`
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
  };
}

export type EserviceTemplateVersionInterfaceRepository = ReturnType<
  typeof eserviceTemplateVersionInterfaceRepository
>;
