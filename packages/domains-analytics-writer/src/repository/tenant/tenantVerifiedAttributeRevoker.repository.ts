/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { TenantVerifiedAttributeRevokerSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

import { TenantDbTable } from "../../model/db.js";
import {
  TenantVerifiedAttributeRevokerMapping,
  TenantVerifiedAttributeRevokerSchema,
} from "../../model/tenant/tenantVerifiedAttributeRevoker.js";

export function tenantVerifiedAttributeRevokerRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = TenantDbTable.tenant_verified_attribute_revoker;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: TenantVerifiedAttributeRevokerSQL[]
    ): Promise<void> {
      try {
        const mapping: TenantVerifiedAttributeRevokerMapping = {
          tenant_id: (r) => r.tenantId,
          metadata_version: (r) => r.metadataVersion,
          tenant_revoker_id: (r) => r.tenantRevokerId,
          tenant_verified_attribute_id: (r) => r.tenantVerifiedAttributeId,
          verification_date: (r) => r.verificationDate,
          expiration_date: (r) => r.expirationDate,
          extension_date: (r) => r.extensionDate,
          revocation_date: (r) => r.revocationDate,
          delegation_id: (r) => r.delegationId,
          deleted: () => false,
        };

        const cs = buildColumnSet<TenantVerifiedAttributeRevokerSQL>(
          pgp,
          mapping,
          stagingTable
        );

        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.tenant_id = b.tenant_id
            AND a.tenant_verified_attribute_id = b.tenant_verified_attribute_id
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
          TenantVerifiedAttributeRevokerSchema,
          schemaName,
          tableName,
          stagingTable,
          ["tenant_id", "tenant_verified_attribute_id"]
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
  };
}

export type TenantVerifiedAttributeRevokerRepository = ReturnType<
  typeof tenantVerifiedAttributeRevokerRepository
>;
