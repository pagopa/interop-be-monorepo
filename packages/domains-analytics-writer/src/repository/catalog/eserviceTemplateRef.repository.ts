/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceTemplateRefSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceTemplateRefMapping,
  eserviceTemplateRefSchema,
} from "../../model/catalog/eserviceTemplateRef.js";

export function eserviceTemplateRefRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = "eservice_template_ref";
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceTemplateRefSQL[]
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
          eserviceTemplateRefSchema,
          schemaName,
          tableName,
          `${tableName}${config.mergeTableSuffix}`,
          "eservice_template_id"
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

export type EserviceTemplateRefRepository = ReturnType<
  typeof eserviceTemplateRefRepository
>;
