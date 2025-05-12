/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceDescriptorAttributeSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceDescriptorAttributeMapping,
  EserviceDescriptorAttributeSchema,
} from "../../model/catalog/eserviceDescriptorAttribute.js";
import { CatalogDbTable } from "../../model/db.js";

export function eserviceDescriptorAttributeRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor_attribute;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorAttributeSQL[]
    ): Promise<void> {
      const mapping: EserviceDescriptorAttributeMapping = {
        eservice_id: (r: EServiceDescriptorAttributeSQL) => r.eserviceId,
        metadata_version: (r: EServiceDescriptorAttributeSQL) =>
          r.metadataVersion,
        attribute_id: (r: EServiceDescriptorAttributeSQL) => r.attributeId,
        descriptor_id: (r: EServiceDescriptorAttributeSQL) => r.descriptorId,
        explicit_attribute_verification: (r: EServiceDescriptorAttributeSQL) =>
          r.explicitAttributeVerification,
        kind: (r: EServiceDescriptorAttributeSQL) => r.kind,
        group_id: (r: EServiceDescriptorAttributeSQL) => r.groupId,
      };
      const cs = buildColumnSet<EServiceDescriptorAttributeSQL>(
        pgp,
        mapping,
        stagingTable
      );
      try {
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.attribute_id = b.attribute_id
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
          EserviceDescriptorAttributeSchema,
          schemaName,
          tableName,
          `${tableName}_${config.mergeTableSuffix}`,
          ["attribute_id"]
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
