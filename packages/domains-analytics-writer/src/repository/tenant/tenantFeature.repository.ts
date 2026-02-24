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
import { TenantFeatureSchema } from "../../model/tenant/tenantFeature.js";
import { TenantDbTable } from "../../model/db/index.js";

export function tenantFeatureRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = TenantDbTable.tenant_feature;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: TenantFeatureSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, TenantFeatureSchema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(tableName, ["tenantId", "kind"])
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          TenantFeatureSchema,
          schemaName,
          tableName,
          ["tenantId", "kind"]
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
  };
}
