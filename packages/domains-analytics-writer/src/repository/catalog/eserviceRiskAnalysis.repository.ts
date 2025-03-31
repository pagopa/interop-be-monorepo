/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { z } from "zod";
import { EServiceRiskAnalysisSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

const eserviceRiskAnalysisSchema = z.object({
  id: z.string(),
  metadata_version: z.number(),
  eservice_id: z.string(),
  name: z.string(),
  created_at: z.string(),
  risk_analysis_form_id: z.string(),
  risk_analysis_form_version: z.number(),
});

export function eserviceRiskAnalysisRepository(conn: DBConnection) {
  const schemaName = "domains_catalog";
  const tableName = "eservice_risk_analysis";
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceRiskAnalysisSQL[]
    ): Promise<void> {
      const mapping = {
        id: (r: EServiceRiskAnalysisSQL) => r.id,
        metadata_version: (r: EServiceRiskAnalysisSQL) => r.metadataVersion,
        eservice_id: (r: EServiceRiskAnalysisSQL) => r.eserviceId,
        name: (r: EServiceRiskAnalysisSQL) => r.name,
        created_at: (r: EServiceRiskAnalysisSQL) => r.createdAt,
        risk_analysis_form_id: (r: EServiceRiskAnalysisSQL) =>
          r.riskAnalysisFormId,
        risk_analysis_form_version: (r: EServiceRiskAnalysisSQL) =>
          r.riskAnalysisFormVersion,
      };
      const cs = buildColumnSet<EServiceRiskAnalysisSQL>(
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
          eserviceRiskAnalysisSchema,
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

export type EserviceRiskAnalysisRepository = ReturnType<
  typeof eserviceRiskAnalysisRepository
>;
