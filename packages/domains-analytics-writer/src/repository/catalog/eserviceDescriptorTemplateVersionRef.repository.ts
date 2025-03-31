/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { z } from "zod";
import { EServiceDescriptorTemplateVersionRefSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

const eserviceDescriptorTemplateVersionRefSchema = z.object({
  eservice_template_version_id: z.string(),
  eservice_id: z.string(),
  metadata_version: z.number(),
  descriptor_id: z.string(),
  contact_name: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_url: z.string().nullable(),
  terms_and_conditions_url: z.string().nullable(),
});

export function eserviceDescriptorTemplateVersionRefRepository(
  conn: DBConnection
) {
  const schemaName = "domains_catalog";
  const tableName = "eservice_descriptor_template_version_ref";
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorTemplateVersionRefSQL[]
    ): Promise<void> {
      const mapping = {
        eserviceTemplateVersionId: (
          r: EServiceDescriptorTemplateVersionRefSQL
        ) => r.eserviceTemplateVersionId,
        eservice_id: (r: EServiceDescriptorTemplateVersionRefSQL) =>
          r.eserviceId,
        metadata_version: (r: EServiceDescriptorTemplateVersionRefSQL) =>
          r.metadataVersion,
        descriptor_id: (r: EServiceDescriptorTemplateVersionRefSQL) =>
          r.descriptorId,
        contact_name: (r: EServiceDescriptorTemplateVersionRefSQL) =>
          r.contactName,
        contact_email: (r: EServiceDescriptorTemplateVersionRefSQL) =>
          r.contactEmail,
        contact_url: (r: EServiceDescriptorTemplateVersionRefSQL) =>
          r.contactUrl,
        terms_and_conditions_url: (
          r: EServiceDescriptorTemplateVersionRefSQL
        ) => r.termsAndConditionsUrl,
      };
      const cs = buildColumnSet<EServiceDescriptorTemplateVersionRefSQL>(
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
          eserviceDescriptorTemplateVersionRefSchema,
          schemaName,
          tableName,
          config.mergeTableSuffix,
          "eservice_template_version_id"
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

export type EserviceDescriptorTemplateVersionRefRepository = ReturnType<
  typeof eserviceDescriptorTemplateVersionRefRepository
>;
