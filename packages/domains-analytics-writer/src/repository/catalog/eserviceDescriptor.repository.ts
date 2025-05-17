/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceDescriptorSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceDescriptorDeletingMapping,
  EserviceDescriptorMapping,
  EserviceDescriptorSchema,
} from "../../model/catalog/eserviceDescriptor.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db.js";

export function eserviceDescriptorRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.catalog_deleting_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorSQL[]
    ): Promise<void> {
      const mapping: EserviceDescriptorMapping = {
        id: (r) => r.id,
        eserviceId: (r) => r.eserviceId,
        metadataVersion: (r) => r.metadataVersion,
        version: (r) => r.version,
        description: (r) => r.description,
        createdAt: (r) => r.createdAt,
        state: (r) => r.state,
        audience: (r) => JSON.stringify(r.audience),
        voucherLifespan: (r) => r.voucherLifespan,
        dailyCallsPerConsumer: (r) => r.dailyCallsPerConsumer,
        dailyCallsTotal: (r) => r.dailyCallsTotal,
        serverUrls: (r) => JSON.stringify(r.serverUrls),
        agreementApprovalPolicy: (r) => r.agreementApprovalPolicy,
        publishedAt: (r) => r.publishedAt,
        suspendedAt: (r) => r.suspendedAt,
        deprecatedAt: (r) => r.deprecatedAt,
        archivedAt: (r) => r.archivedAt,
      };

      const cs = buildColumnSet(pgp, tableName, mapping);
      try {
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
          EserviceDescriptorSchema,
          schemaName,
          tableName,
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
      recordsId: Array<EServiceDescriptorSQL["id"]>
    ): Promise<void> {
      try {
        const mapping: EserviceDescriptorDeletingMapping = {
          id: (r) => r.id,
          deleted: () => true,
        };
        const cs = buildColumnSet(pgp, stagingDeletingTable, mapping);

        const records = recordsId.map((id) => ({ id }));

        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTable}: ${error}`
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
          `Error merging staging table ${stagingDeletingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(
          `TRUNCATE TABLE ${stagingDeletingTable}_${config.mergeTableSuffix};`
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning deleting staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}

export type EserviceDescriptorRepository = ReturnType<
  typeof eserviceDescriptorRepository
>;
