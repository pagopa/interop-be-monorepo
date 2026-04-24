/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateMergeQuery,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { EserviceTemplateVersionAsyncExchangePropertiesSchema } from "../../model/eserviceTemplate/eserviceTemplateVersionAsyncExchangeProperties.js";

export function eserviceTemplateVersionAsyncExchangePropertiesRepository(
  conn: DBConnection
) {
  const schemaName = config.dbSchemaName;
  const tableName =
    EserviceTemplateDbTable.eservice_template_version_async_exchange_properties;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EserviceTemplateVersionAsyncExchangePropertiesSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tableName,
          EserviceTemplateVersionAsyncExchangePropertiesSchema
        );
        await t.none(pgp.helpers.insert(records, cs));

        await t.none(generateStagingDeleteQuery(tableName, ["versionId"]));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          EserviceTemplateVersionAsyncExchangePropertiesSchema,
          schemaName,
          tableName,
          ["versionId"]
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
