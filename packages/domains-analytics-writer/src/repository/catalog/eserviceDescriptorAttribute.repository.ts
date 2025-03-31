/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { z } from "zod";
import { EServiceDescriptorAttributeSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

const eserviceDescriptorAttributeSchema = z.object({
  eservice_id: z.string(),
  metadata_version: z.number(),
  attribute_id: z.string(),
  descriptor_id: z.string(),
  explicit_attribute_verification: z.boolean(),
  kind: z.string(),
  group_id: z.number(),
});

export function eserviceDescriptorAttributeRepository(conn: DBConnection) {
  const schemaName = "domains_catalog";
  const tableName = "eservice_descriptor_attribute";
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorAttributeSQL[]
    ): Promise<void> {
      const mapping = {
        eservice_id: (r: EServiceDescriptorAttributeSQL) => r.eserviceId,
        metadata_version: (r: EServiceDescriptorAttributeSQL) =>
          r.metadataVersion,
        attribute_id: (r: EServiceDescriptorAttributeSQL) => r.attributeId,
        descriptor_id: (r: EServiceDescriptorAttributeSQL) => r.descriptorId,
        explicit_attribute_verification: (r: EServiceDescriptorAttributeSQL) =>
          r.explicitAttributeVerification ? "true" : "false",
        kind: (r: EServiceDescriptorAttributeSQL) => r.kind,
        group_id: (r: EServiceDescriptorAttributeSQL) => r.groupId,
      };
      const cs = buildColumnSet<EServiceDescriptorAttributeSQL>(
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
          eserviceDescriptorAttributeSchema,
          schemaName,
          tableName,
          config.mergeTableSuffix,
          "attribute_id"
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

export type EserviceDescriptorAttributeRepository = ReturnType<
  typeof eserviceDescriptorAttributeRepository
>;
