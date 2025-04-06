/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceDescriptorTemplateVersionRefSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceDescriptorTemplateVersionRefMapping,
  eserviceDescriptorTemplateVersionRefSchema,
} from "../../model/catalog/eserviceDescriptorTemplateVersionRef.js";
import { CatalogDbTable } from "../../model/db.js";

export function eserviceDescriptorTemplateVersionRefRepository(
  conn: DBConnection
) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor_template_version_ref;
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorTemplateVersionRefSQL[]
    ): Promise<void> {
      const mapping: EserviceDescriptorTemplateVersionRefMapping = {
        eservice_template_version_id: (
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
          eserviceDescriptorTemplateVersionRefSchema,
          schemaName,
          tableName,
          `${tableName}${config.mergeTableSuffix}`,
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
