/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceDescriptorRejectionReasonSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceDescriptorRejectionMapping,
  eserviceDescriptorRejectionSchema,
} from "../../model/catalog/eserviceDescriptorRejection.js";
import { CatalogDbTable } from "../../model/db.js";

export function eserviceDescriptorRejectionRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor_rejection_reason;
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorRejectionReasonSQL[]
    ): Promise<void> {
      const mapping: EserviceDescriptorRejectionMapping = {
        eservice_id: (r: EServiceDescriptorRejectionReasonSQL) => r.eserviceId,
        metadata_version: (r: EServiceDescriptorRejectionReasonSQL) =>
          r.metadataVersion,
        descriptor_id: (r: EServiceDescriptorRejectionReasonSQL) =>
          r.descriptorId,
        rejection_reason: (r: EServiceDescriptorRejectionReasonSQL) =>
          r.rejectionReason,
        rejected_at: (r: EServiceDescriptorRejectionReasonSQL) => r.rejectedAt,
      };
      const cs = buildColumnSet<EServiceDescriptorRejectionReasonSQL>(
        pgp,
        mapping,
        stagingTable
      );
      try {
        if (records.length > 0) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.descriptor_id = b.descriptor_id
          AND a.metadata_version < b.metadata_version;
        `);
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
          eserviceDescriptorRejectionSchema,
          schemaName,
          tableName,
          `${tableName}${config.mergeTableSuffix}`,
          "descriptor_id"
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

export type EserviceDescriptorRejectionRepository = ReturnType<
  typeof eserviceDescriptorRejectionRepository
>;
