/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateMergeDeleteQuery,
  generateMergeQuery,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  TenantSchema,
  TenantDeletingSchema,
  TenantSelfcareIdSchema,
} from "../../model/tenant/tenant.js";
import {
  TenantDbTable,
  DeletingDbTable,
  TenantDbPartialTable,
} from "../../model/db/index.js";

export function tenantRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = TenantDbTable.tenant;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTableName = DeletingDbTable.tenant_deleting_table;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;
  const tenantSelfcareUpsertTableName =
    TenantDbPartialTable.tenant_self_care_id;
  const stagingTenantSelfcareUpsertTableName = `${tenantSelfcareUpsertTableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: TenantSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, TenantSchema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(generateStagingDeleteQuery(tableName, ["id"]));
      } catch (error) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          TenantSchema,
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
      records: TenantDeletingSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, deletingTableName, TenantDeletingSchema);
        await t.none(pgp.helpers.insert(records, cs));
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
          ["id"],
          true,
          false
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

    async insertTenantSelfcareId(
      t: ITask<unknown>,
      pgp: IMain,
      records: TenantSelfcareIdSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tenantSelfcareUpsertTableName,
          TenantSelfcareIdSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(
            tableName,
            ["id"],
            tenantSelfcareUpsertTableName
          )
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTenantSelfcareUpsertTableName}: ${error}`
        );
      }
    },

    async mergeTenantSelfcareId(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          TenantSelfcareIdSchema,
          schemaName,
          tableName,
          ["id"],
          tenantSelfcareUpsertTableName
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTenantSelfcareUpsertTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },
  };
}
