/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { PurposeRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { DBContext } from "../../db/db.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import {
  PurposeRiskAnalysisAnswerMapping,
  PurposeRiskAnalysisAnswerSchema,
} from "../../model/purpose/purposeRiskAnalysisAnswer.js";
import { PurposeDbTable } from "../../model/db.js";

export function purposeRiskAnalysisAnswerRepository(conn: DBContext["conn"]) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose_risk_analysis_answer;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeRiskAnalysisAnswerSQL[]
    ) {
      const mapping: PurposeRiskAnalysisAnswerMapping = {
        id: (r: PurposeRiskAnalysisAnswerSQL) => r.id,
        purpose_id: (r: PurposeRiskAnalysisAnswerSQL) => r.purposeId,
        metadata_version: (r: PurposeRiskAnalysisAnswerSQL) =>
          r.metadataVersion,
        risk_analysis_form_id: (r: PurposeRiskAnalysisAnswerSQL) =>
          r.riskAnalysisFormId,
        kind: (r: PurposeRiskAnalysisAnswerSQL) => r.kind,
        key: (r: PurposeRiskAnalysisAnswerSQL) => r.key,
        value: (r: PurposeRiskAnalysisAnswerSQL) =>
          r.value ? JSON.stringify(r.value) : null,
      };
      const cs = buildColumnSet<PurposeRiskAnalysisAnswerSQL>(
        pgp,
        mapping,
        stagingTable
      );
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
        }
      } catch (error) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            PurposeRiskAnalysisAnswerSchema,
            schemaName,
            tableName,
            stagingTable,
            ["id", "purpose_id"]
          )
        );
      } catch (error) {
        throw genericInternalError(
          `Error merging staging table ${stagingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (error) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTable}: ${error}`
        );
      }
    },
  };
}
