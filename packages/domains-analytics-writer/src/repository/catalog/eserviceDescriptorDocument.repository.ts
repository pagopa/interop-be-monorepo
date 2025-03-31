/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { z } from "zod";
import { EServiceDescriptorDocumentSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

const eserviceDescriptorDocumentSchema = z.object({
  id: z.string(),
  eservice_id: z.string(),
  metadata_version: z.number(),
  descriptor_id: z.string(),
  name: z.string(),
  content_type: z.string(),
  pretty_name: z.string(),
  path: z.string(),
  checksum: z.string(),
  upload_date: z.string(),
});

export function eserviceDescriptorDocumentRepository(conn: DBConnection) {
  const schemaName = "domains_catalog";
  const tableName = "eservice_descriptor_document";
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorDocumentSQL[]
    ): Promise<void> {
      const mapping = {
        id: (r: EServiceDescriptorDocumentSQL) => r.id,
        eservice_id: (r: EServiceDescriptorDocumentSQL) => r.eserviceId,
        metadata_version: (r: EServiceDescriptorDocumentSQL) =>
          r.metadataVersion,
        descriptor_id: (r: EServiceDescriptorDocumentSQL) => r.descriptorId,
        name: (r: EServiceDescriptorDocumentSQL) => r.name,
        content_type: (r: EServiceDescriptorDocumentSQL) => r.contentType,
        pretty_name: (r: EServiceDescriptorDocumentSQL) => r.prettyName,
        path: (r: EServiceDescriptorDocumentSQL) => r.path,
        checksum: (r: EServiceDescriptorDocumentSQL) => r.checksum,
        upload_date: (r: EServiceDescriptorDocumentSQL) => r.uploadDate,
      };
      const cs = buildColumnSet<EServiceDescriptorDocumentSQL>(
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
          eserviceDescriptorDocumentSchema,
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

export type EserviceDescriptorDocumentRepository = ReturnType<
  typeof eserviceDescriptorDocumentRepository
>;
