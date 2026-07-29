/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { PurposeRiskAnalysisReviewerSchema } from "pagopa-interop-kpi-models";
import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";

import { config } from "../../config/config.js";
import { DBConnection } from "../../db/db.js";
import { PurposeDbTable } from "../../model/db/index.js";
import {
  buildColumnSet,
  generateMergeQuery,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";

export function purposeRiskAnalysisReviewerRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose_risk_analysis_reviewer;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeRiskAnalysisReviewerSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tableName,
          PurposeRiskAnalysisReviewerSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(tableName, ["purposeId", "reviewerId"])
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          PurposeRiskAnalysisReviewerSchema,
          schemaName,
          tableName,
          ["purposeId", "reviewerId"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTableName}: ${error}`
        );
      }
    },
  };
}
