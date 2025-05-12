/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { TenantFeatureSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  TenantFeatureSchema,
  TenantFeatureMapping,
  TenantFeatureDeletingMapping,
} from "../../model/tenant/tenantFeature.js";
import { TenantDbTable, DeletingDbTable } from "../../model/db.js";

export function tenantFeatureRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = TenantDbTable.tenant_feature;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.tenant_feature_deleting_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: TenantFeatureSQL[]
    ): Promise<void> {
      try {
        const mapping: TenantFeatureMapping = {
          tenant_id: (r) => r.tenantId,
          metadata_version: (r) => r.metadataVersion,
          kind: (r) => r.kind,
          certifier_id: (r) => r.certifierId,
          availability_timestamp: (r) => r.availabilityTimestamp,
          deleted: () => false,
        };

        const cs = buildColumnSet<TenantFeatureSQL>(pgp, mapping, stagingTable);

        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.tenant_id = b.tenant_id
            AND a.kind = b.kind
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
          TenantFeatureSchema,
          schemaName,
          tableName,
          stagingTable,
          ["tenant_id", "kind"]
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
      records: TenantFeatureSQL[]
    ): Promise<void> {
      const mapping: TenantFeatureDeletingMapping = {
        tenant_id: (r) => r.tenantId,
        kind: (r) => r.kind,
        deleted: () => true,
      };

      try {
        const cs = buildColumnSet<TenantFeatureSQL>(
          pgp,
          mapping,
          stagingDeletingTable
        );

        const results = records.map((record: TenantFeatureSQL) => ({
          ...record,
          deleted: true,
        }));

        await t.none(
          pgp.helpers.insert(results, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${stagingDeletingTable}: ${error}`
        );
      }
    },

    async mergeDeleting(): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          stagingDeletingTable,
          ["tenant_id", "kind"],
          false
        );
        await conn.none(mergeQuery);
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

export type TenantFeatureRepository = ReturnType<
  typeof tenantFeatureRepository
>;
