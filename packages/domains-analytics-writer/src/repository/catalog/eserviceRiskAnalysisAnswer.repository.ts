/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceRiskAnalysisAnswerMapping,
  eserviceRiskAnalysisAnswerSchema,
} from "../../model/catalog/eserviceRiskAnalysisAnswer.js";
import { CatalogDbTable } from "../../model/db.js";

export function eserviceRiskAnalysisAnswerRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_risk_analysis_answer;
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceRiskAnalysisAnswerSQL[]
    ): Promise<void> {
      const mapping: EserviceRiskAnalysisAnswerMapping = {
        id: (r: EServiceRiskAnalysisAnswerSQL) => r.id,
        eservice_id: (r: EServiceRiskAnalysisAnswerSQL) => r.eserviceId,
        metadata_version: (r: EServiceRiskAnalysisAnswerSQL) =>
          r.metadataVersion,
        risk_analysis_form_id: (r: EServiceRiskAnalysisAnswerSQL) =>
          r.riskAnalysisFormId,
        kind: (r: EServiceRiskAnalysisAnswerSQL) => r.kind,
        key: (r: EServiceRiskAnalysisAnswerSQL) => r.key,
        value: (r: EServiceRiskAnalysisAnswerSQL) => JSON.stringify(r.value),
      };
      const cs = buildColumnSet<EServiceRiskAnalysisAnswerSQL>(
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
          WHERE a.id = b.id
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
          eserviceRiskAnalysisAnswerSchema,
          schemaName,
          tableName,
          `${tableName}${config.mergeTableSuffix}`,
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

export type EserviceRiskAnalysisAnswerRepository = ReturnType<
  typeof eserviceRiskAnalysisAnswerRepository
>;
