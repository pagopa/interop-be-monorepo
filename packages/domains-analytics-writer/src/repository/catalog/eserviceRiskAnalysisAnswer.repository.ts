/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { z } from "zod";
import { EServiceRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

const eserviceRiskAnalysisAnswerSchema = z.object({
  id: z.string(),
  eservice_id: z.string(),
  metadata_version: z.number(),
  risk_analysis_form_id: z.string(),
  kind: z.string(),
  key: z.string(),
  value: z.array(z.string()),
});

export function eserviceRiskAnalysisAnswerRepository(conn: DBConnection) {
  const schemaName = "domains_catalog";
  const tableName = "eservice_risk_analysis_answer";
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceRiskAnalysisAnswerSQL[]
    ): Promise<void> {
      const mapping = {
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

export type EserviceRiskAnalysisAnswerRepository = ReturnType<
  typeof eserviceRiskAnalysisAnswerRepository
>;
