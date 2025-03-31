/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { EServiceDescriptorSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceDescriptorMapping,
  eserviceDescriptorSchema,
} from "../../model/catalog/eserviceDescriptor.js";

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
        published_at: (r: EServiceDescriptorSQL) =>
          r.publishedAt ? r.publishedAt : "",
        suspended_at: (r: EServiceDescriptorSQL) =>
          r.suspendedAt ? r.suspendedAt : "",
        deprecated_at: (r: EServiceDescriptorSQL) =>
          r.deprecatedAt ? r.deprecatedAt : "",
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
