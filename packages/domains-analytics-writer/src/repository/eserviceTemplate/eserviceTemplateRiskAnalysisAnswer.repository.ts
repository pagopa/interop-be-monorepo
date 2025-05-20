/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { z } from "zod";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateMergeQuery,
  generateMergeDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

import {
  EserviceTemplateDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";
import { EserviceTemplateDeletingSchema } from "../../model/eserviceTemplate/eserviceTemplate.js";
import { EserviceTemplateRiskAnalysisAnswerSchema } from "../../model/eserviceTemplate/eserviceTemplateRiskAnalysisAnswer.js";

export function eserviceTemplateRiskAnalysisAnswerRepository(
  conn: DBConnection
) {
  const schemaName = config.dbSchemaName;
  const tableName =
    EserviceTemplateDbTable.eservice_template_risk_analysis_answer;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTableName = DeletingDbTable.eservice_template_deleting_table;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: Array<z.infer<typeof EserviceTemplateRiskAnalysisAnswerSchema>>
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tableName,
          EserviceTemplateRiskAnalysisAnswerSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTableName} a
          USING ${stagingTableName} b
          WHERE a.id = b.id
            AND a.metadata_version < b.metadata_version;
        `);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          EserviceTemplateRiskAnalysisAnswerSchema,
          schemaName,
          tableName,
          ["id"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error truncating staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async insertDeleting(
      t: ITask<unknown>,
      pgp: IMain,
      records: Array<z.infer<typeof EserviceTemplateDeletingSchema>>
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          deletingTableName,
          EserviceTemplateDeletingSchema
        );
        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting staging table ${stagingDeletingTableName}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeDelQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          deletingTableName,
          ["id"]
        );
        await t.none(mergeDelQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging deleting staging into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error truncating deleting staging table ${stagingDeletingTableName}: ${error}`
        );
      }
    },
  };
}

export type EserviceTemplateRiskAnalysisAnswerRepository = ReturnType<
  typeof eserviceTemplateRiskAnalysisAnswerRepository
>;
