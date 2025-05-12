/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { TenantSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  TenantSchema,
  TenantMapping,
  TenantDeletingMapping,
} from "../../model/tenant/tenant.js";
import { TenantDbTable, DeletingDbTable } from "../../model/db.js";

export function tenantRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = TenantDbTable.tenant;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.tenant_deleting_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: TenantSQL[]
    ): Promise<void> {
      try {
        const mapping: TenantMapping = {
          id: (r) => r.id,
          metadata_version: (r) => r.metadataVersion,
          kind: (r) => r.kind,
          selfcare_id: (r) => r.selfcareId,
          external_id_origin: (r) => r.externalIdOrigin,
          external_id_value: (r) => r.externalIdValue,
          created_at: (r) => r.createdAt,
          updated_at: (r) => r.updatedAt,
          name: (r) => r.name,
          onboarded_at: (r) => r.onboardedAt,
          sub_unit_type: (r) => r.subUnitType,
          deleted: () => false,
        };

        const cs = buildColumnSet<TenantSQL>(pgp, mapping, stagingTable);

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
          TenantSchema,
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
      recordsId: Array<TenantSQL["id"]>
    ): Promise<void> {
      try {
        const mapping: TenantDeletingMapping = {
          id: (r) => r.id,
          deleted: () => true,
        };

        const cs = buildColumnSet<TenantSQL>(
          pgp,
          mapping,
          stagingDeletingTable
        );

        const records = recordsId.map((id: string) => ({ id, deleted: true }));

        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${stagingDeletingTable}: ${error}`
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
          `Error merging deleting table ${stagingDeletingTable} into ${schemaName}.${tableName}: ${error}`
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

export type TenantRepository = ReturnType<typeof tenantRepository>;
