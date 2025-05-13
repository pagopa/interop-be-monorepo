/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { PurposeRiskAnalysisFormSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { DBContext } from "../../db/db.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { PurposeRiskAnalysisFormSchema } from "../../model/purpose/purposeRiskAnalysis.js";
import { config } from "../../config/config.js";
import { PurposeDbTable } from "../../model/db.js";

export function purposeRiskAnalysisFormRepository(conn: DBContext["conn"]) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose_risk_analysis_form;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeRiskAnalysisFormSQL[]
    ) {
      const mapping = {
        id: (r: PurposeRiskAnalysisFormSQL) => r.id,
        purpose_id: (r: PurposeRiskAnalysisFormSQL) => r.purposeId,
        metadata_version: (r: PurposeRiskAnalysisFormSQL) => r.metadataVersion,
        version: (r: PurposeRiskAnalysisFormSQL) => r.version,
        risk_analysis_id: (r: PurposeRiskAnalysisFormSQL) => r.riskAnalysisId,
      };
      const cs = buildColumnSet<PurposeRiskAnalysisFormSQL>(
        pgp,
        mapping,
        stagingTable
      );
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
        }
      } catch (e) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${e}`
        );
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            PurposeRiskAnalysisFormSchema,
            schemaName,
            tableName,
            stagingTable,
            ["id", "purpose_id"]
          )
        );
      } catch (e) {
        throw genericInternalError(`merge purpose_risk_analysis_form: ${e}`);
      }
    },

    async clean() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (e) {
        throw genericInternalError(
          `clean purpose_risk_analysis_form stagingTable: ${e}`
        );
      }
    },
  };
}
