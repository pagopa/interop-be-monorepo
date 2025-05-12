/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { TenantVerifiedAttributeVerifierSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

import { TenantDbTable } from "../../model/db.js";
import {
  TenantVerifiedAttributeVerifierMapping,
  TenantVerifiedAttributeVerifierSchema,
} from "../../model/tenant/tenantVerifiedAttributeVerifier.js";

export function tenantVerifiedAttributeVerifierRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = TenantDbTable.tenant_verified_attribute_verifier;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: TenantVerifiedAttributeVerifierSQL[]
    ): Promise<void> {
      try {
        const mapping: TenantVerifiedAttributeVerifierMapping = {
          tenant_id: (r) => r.tenantId,
          metadata_version: (r) => r.metadataVersion,
          tenant_verifier_id: (r) => r.tenantId,
          tenant_verified_attribute_id: (r) => r.tenantVerifiedAttributeId,
          verification_date: (r) => r.verificationDate,
          expiration_date: (r) => r.expirationDate,
          extension_date: (r) => r.extensionDate,
          delegation_id: (r) => r.delegationId,
          deleted: () => false,
        };

        const cs = buildColumnSet<TenantVerifiedAttributeVerifierSQL>(
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
          TenantVerifiedAttributeVerifierSchema,
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

export type TenantVerifiedAttributeVerifierRepository = ReturnType<
  typeof tenantVerifiedAttributeVerifierRepository
>;
