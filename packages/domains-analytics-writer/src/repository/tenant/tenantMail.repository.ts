/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { TenantMailSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  TenantMailSchema,
  TenantMailMapping,
  TenantMailDeletingMapping,
} from "../../model/tenant/tenantMail.js";
import { TenantDbTable, DeletingDbTable } from "../../model/db.js";

export function tenantMailRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = TenantDbTable.tenant_mail;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.tenant_mail_deleting_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: TenantMailSQL[]
    ): Promise<void> {
      try {
        const mapping: TenantMailMapping = {
          id: (r) => r.id,
          tenant_id: (r) => r.tenantId,
          metadata_version: (r) => r.metadataVersion,
          kind: (r) => r.kind,
          address: (r) => r.address,
          description: (r) => r.description,
          created_at: (r) => r.createdAt,
          deleted: () => false,
        };

        const cs = buildColumnSet<TenantMailSQL>(pgp, mapping, stagingTable);

        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.id = b.id
            AND a.tenant_id = b.tenant_id
            AND a.created_at = b.created_at
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
          TenantMailSchema,
          schemaName,
          tableName,
          stagingTable,
          ["id", "tenant_id", "created_at"]
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
      records: Array<TenantMailSQL["id"]>
    ): Promise<void> {
      const mapping: TenantMailDeletingMapping = {
        id: (r) => r.id,
        deleted: () => true,
      };

      try {
        const cs = buildColumnSet<TenantMailSQL>(
          pgp,
          mapping,
          stagingDeletingTable
        );

        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
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
          ["id"]
        );
        await conn.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging deleting table ${stagingDeletingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async insertDeletingByMailIdAndTenantId(
      t: ITask<unknown>,
      pgp: IMain,
      records: Array<Pick<TenantMailSQL, "id" | "tenantId">>
    ): Promise<void> {
      const mapping: TenantMailDeletingMapping = {
        id: (r) => r.id,
        tenant_id: (r) => r.tenantId,
        deleted: () => true,
      };

      try {
        const cs = buildColumnSet<TenantMailSQL>(
          pgp,
          mapping,
          stagingDeletingTable
        );

        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${stagingDeletingTable}: ${error}`
        );
      }
    },

    async mergeDeletingByMailIdAndTenantId(): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          stagingDeletingTable,
          ["id", "tenant_id"],
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

export type TenantMailRepository = ReturnType<typeof tenantMailRepository>;
