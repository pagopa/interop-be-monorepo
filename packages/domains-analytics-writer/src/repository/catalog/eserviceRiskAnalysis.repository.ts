/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceRiskAnalysisDeletingSchema,
  EserviceRiskAnalysisSchema,
} from "../../model/catalog/eserviceRiskAnalysis.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db/index.js";

export function eserviceRiskAnalysisRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_risk_analysis;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTableName = DeletingDbTable.catalog_risk_deleting_table;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EserviceRiskAnalysisSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, EserviceRiskAnalysisSchema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(generateStagingDeleteQuery(tableName, ["eserviceId"]));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          EserviceRiskAnalysisSchema,
          schemaName,
          tableName,
          ["id", "eserviceId"]
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

    async insertDeleting(
      t: ITask<unknown>,
      pgp: IMain,
      records: EserviceRiskAnalysisDeletingSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          deletingTableName,
          EserviceRiskAnalysisDeletingSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${stagingDeletingTableName}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          deletingTableName,
          ["id", "eserviceId"],
          false
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging deleting table ${stagingDeletingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning deleting staging table ${stagingDeletingTableName}: ${error}`
        );
      }
    },
  };
}

export type EserviceRiskAnalysisRepository = ReturnType<
  typeof eserviceRiskAnalysisRepository
>;
