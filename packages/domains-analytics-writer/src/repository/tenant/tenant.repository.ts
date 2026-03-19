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
import { TenantSchema } from "pagopa-interop-kpi-models";
import {
  TenantDeletingSchema,
  TenantSelfcareIdSchema,
} from "../../model/tenant/tenant.js";
import {
  TenantDbTable,
  DeletingDbTable,
  TenantDbPartialTable,
} from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export function tenantRepository(conn: DBConnection) {
  const base = createRepository(conn, {
    tableName: TenantDbTable.tenant,
    schema: TenantSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.tenant_deleting_table,
      deletingSchema: TenantDeletingSchema,
      physicalDelete: false,
    },
  });

  const schemaName = config.dbSchemaName;
  const tableName = TenantDbTable.tenant;
  const tenantSelfcareUpsertTableName =
    TenantDbPartialTable.tenant_self_care_id;
  const stagingTenantSelfcareUpsertTableName = `${tenantSelfcareUpsertTableName}_${config.mergeTableSuffix}`;

  return {
    ...base,

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
