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
          await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.id = b.id
          AND a.purpose_id = b.purpose_id
          AND a.metadata_version < b.metadata_version;
        `);
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
            PurposeRiskAnalysisFormSchema,
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
