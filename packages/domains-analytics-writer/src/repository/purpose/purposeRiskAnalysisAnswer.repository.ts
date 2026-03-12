/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import {
  buildColumnSet,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { DBConnection } from "../../db/db.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { PurposeRiskAnalysisAnswerSchema } from "../../model/purpose/purposeRiskAnalysisAnswer.js";
import { PurposeDbTable } from "../../model/db/index.js";

export function purposeRiskAnalysisAnswerRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose_risk_analysis_answer;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeRiskAnalysisAnswerSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tableName,
          PurposeRiskAnalysisAnswerSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(tableName, ["id", "purposeId"])
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
          PurposeRiskAnalysisAnswerSchema,
          schemaName,
          tableName,
          ["id", "purposeId"]
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
