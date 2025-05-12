/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { TenantCertifiedAttributeSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

import { TenantDbTable } from "../../model/db.js";
import {
  TenantCertifiedAttributeMapping,
  TenantCertifiedAttributeSchema,
} from "../../model/tenant/tenantCertifiedAttribute.js";

export function tenantCertifiedAttributeRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = TenantDbTable.tenant_certified_attribute;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: TenantCertifiedAttributeSQL[]
    ): Promise<void> {
      try {
        const mapping: TenantCertifiedAttributeMapping = {
          tenant_id: (r) => r.tenantId,
          metadata_version: (r) => r.metadataVersion,
          attribute_id: (r) => r.attributeId,
          assignment_timestamp: (r) => r.assignmentTimestamp,
          revocation_timestamp: (r) => r.revocationTimestamp,
          deleted: () => false,
        };

        const cs = buildColumnSet<TenantCertifiedAttributeSQL>(
          pgp,
          mapping,
          stagingTable
        );

        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.attribute_id = b.attribute_id
            AND a.tenant_id = b.tenant_id
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
          TenantCertifiedAttributeSchema,
          schemaName,
          tableName,
          stagingTable,
          ["attribute_id", "tenant_id"]
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

export type TenantCertifiedAttributeRepository = ReturnType<
  typeof tenantCertifiedAttributeRepository
>;
