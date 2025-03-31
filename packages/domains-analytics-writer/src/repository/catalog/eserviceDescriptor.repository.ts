/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { z } from "zod";
import { EServiceDescriptorSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

const eserviceDescriptorSchema = z.object({
  id: z.string(),
  eservice_id: z.string(),
  metadata_version: z.number(),
  version: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  state: z.string(),
  audience: z.string(),
  voucher_lifespan: z.number(),
  daily_calls_per_consumer: z.number(),
  daily_calls_total: z.number(),
  server_urls: z.string(),
  agreement_approval_policy: z.string().nullable(),
  published_at: z.string(),
  suspended_at: z.string(),
  deprecated_at: z.string(),
  archived_at: z.string().nullable(),
});

export function eserviceDescriptorRepository(conn: DBConnection) {
  const schemaName = "domains_catalog";
  const tableName = "eservice_descriptor";
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorSQL[]
    ): Promise<void> {
      const mapping = {
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
          config.mergeTableSuffix,
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
  };
}

export type EserviceDescriptorRepository = ReturnType<
  typeof eserviceDescriptorRepository
>;
