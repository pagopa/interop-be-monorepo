/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceTemplateRefSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceTemplateRefMapping,
  eserviceTemplateRefSchema,
} from "../../model/catalog/eserviceTemplateRef.js";
import { CatalogDbTable } from "../../model/db.js";

export function eserviceTemplateRefRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_template_ref;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: Array<EServiceTemplateRefSQL | undefined>,
    ): Promise<void> {
      const mapping: EserviceTemplateRefMapping = {
        eservice_template_id: (r: EServiceTemplateRefSQL) =>
          r.eserviceTemplateId,
        eservice_id: (r: EServiceTemplateRefSQL) => r.eserviceId,
        metadata_version: (r: EServiceTemplateRefSQL) => r.metadataVersion,
        instance_label: (r: EServiceTemplateRefSQL) => r.instanceLabel,
      };
      const cs = buildColumnSet<EServiceTemplateRefSQL>(
        pgp,
        mapping,
        stagingTable,
      );
      try {
        if (records.length > 0) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.eservice_template_id = b.eservice_template_id
          AND a.metadata_version < b.metadata_version;
        `);
        }
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`,
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          eserviceTemplateRefSchema,
          schemaName,
          tableName,
          `${tableName}_${config.mergeTableSuffix}`,
          ["eservice_template_id"],
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTable} into ${schemaName}.${tableName}: ${error}`,
        );
      }
    },

    async clean(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTable}: ${error}`,
        );
      }
    },
  };
}

export type EserviceTemplateRefRepository = ReturnType<
  typeof eserviceTemplateRefRepository
>;
