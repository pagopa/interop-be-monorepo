/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import { buildColumnSet } from "../../utils/sqlQueryHelper.js";
import { DBConnection } from "../../db/db.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { PurposeRiskAnalysisFormSchema } from "../../model/purpose/purposeRiskAnalysis.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { clean, merge } from "../../utils/repositoryUtils.js";

export function purposeRiskAnalysisFormRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose_risk_analysis_form;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeRiskAnalysisFormSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tableName,
          PurposeRiskAnalysisFormSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTableName} a
          USING ${stagingTableName} b
          WHERE a.id = b.id
          AND a.purpose_id = b.purpose_id
          AND a.metadata_version < b.metadata_version;
        `);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      const mergeQuery = generateMergeQuery(
        PurposeRiskAnalysisFormSchema,
        schemaName,
        tableName,
        ["id", "purposeId"]
      );

      await merge(t, mergeQuery, stagingTableName, schemaName, tableName);
    },

    async clean(): Promise<void> {
      await clean(conn, stagingTableName);
    },
  };
}

export type PurposeRiskAnalysisFormRepo = ReturnType<
  typeof purposeRiskAnalysisFormRepo
>;
