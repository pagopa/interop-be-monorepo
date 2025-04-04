/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceDescriptorSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceDescriptorMapping,
  eserviceDescriptorSchema,
} from "../../model/catalog/eserviceDescriptor.js";
import { CatalogDbTable } from "../../model/db.js";

export function eserviceDescriptorRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor;
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;
  const stagingDeletingTable = `deleting_by_id_table`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorSQL[]
    ): Promise<void> {
      const mapping: EserviceDescriptorMapping = {
        id: (r: EServiceDescriptorSQL) => r.id,
        eservice_id: (r: EServiceDescriptorSQL) => r.eserviceId,
        metadata_version: (r: EServiceDescriptorSQL) => r.metadataVersion,
        version: (r: EServiceDescriptorSQL) => r.version,
        description: (r: EServiceDescriptorSQL) => r.description,
        created_at: (r: EServiceDescriptorSQL) => r.createdAt,
        state: (r: EServiceDescriptorSQL) => r.state,
        audience: (r: EServiceDescriptorSQL) => JSON.stringify(r.audience),
        voucher_lifespan: (r: EServiceDescriptorSQL) => r.voucherLifespan,
        daily_calls_per_consumer: (r: EServiceDescriptorSQL) =>
          r.dailyCallsPerConsumer,
        daily_calls_total: (r: EServiceDescriptorSQL) => r.dailyCallsTotal,
        server_urls: (r: EServiceDescriptorSQL) => JSON.stringify(r.serverUrls),
        agreement_approval_policy: (r: EServiceDescriptorSQL) =>
          r.agreementApprovalPolicy,
        published_at: (r: EServiceDescriptorSQL) => r.publishedAt,
        suspended_at: (r: EServiceDescriptorSQL) => r.suspendedAt,
        deprecated_at: (r: EServiceDescriptorSQL) => r.deprecatedAt,
        archived_at: (r: EServiceDescriptorSQL) => r.archivedAt,
      };
      const cs = buildColumnSet<EServiceDescriptorSQL>(
        pgp,
        mapping,
        stagingTable
      );
      try {
        if (records.length > 0) {
          await t.none(pgp.helpers.insert(records, cs));
        }
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          eserviceDescriptorSchema,
          schemaName,
          tableName,
          stagingTable,
          "id"
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

    async insertDeletingByDescriptorId(
      t: ITask<unknown>,
      pgp: IMain,
      id: string
    ): Promise<void> {
      const mapping = {
        id: () => id,
        deleted: () => true,
      };
      try {
        const cs = buildColumnSet<{ id: string; deleted: boolean }>(
          pgp,
          mapping,
          stagingDeletingTable
        );

        await t.none(pgp.helpers.insert({ id, deleted: true }, cs));
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
          "id"
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
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}

export type EserviceDescriptorRepository = ReturnType<
  typeof eserviceDescriptorRepository
>;
