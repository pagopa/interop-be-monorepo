/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceRiskAnalysisSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceRiskAnalysisDeletingMapping,
  EserviceRiskAnalysisMapping,
  EserviceRiskAnalysisSchema,
} from "../../model/catalog/eserviceRiskAnalysis.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db.js";

export function eserviceRiskAnalysisRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_risk_analysis;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.catalog_risk_deleting_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceRiskAnalysisSQL[]
    ): Promise<void> {
      const mapping: EserviceRiskAnalysisMapping = {
        id: (r) => r.id,
        metadataVersion: (r) => r.metadataVersion,
        eserviceId: (r) => r.eserviceId,
        name: (r) => r.name,
        createdAt: (r) => r.createdAt,
        riskAnalysisFormId: (r) => r.riskAnalysisFormId,
        riskAnalysisFormVersion: (r) => r.riskAnalysisFormVersion,
      };
      const cs = buildColumnSet(pgp, tableName, mapping);
      try {
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.id = b.id
            AND a.eservice_id = b.eservice_id
            AND a.metadata_version < b.metadata_version;
        `);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
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

    async insertDeleting(
      t: ITask<unknown>,
      pgp: IMain,
      records: Array<Pick<EServiceRiskAnalysisSQL, "id" | "eserviceId">>
    ): Promise<void> {
      const mapping: EserviceRiskAnalysisDeletingMapping = {
        id: (r) => r.id,
        eserviceId: (r) => r.eserviceId,
        deleted: () => true,
      };
      try {
        const cs = buildColumnSet(pgp, stagingDeletingTable, mapping);
        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${stagingDeletingTable}: ${error}`
        );
      }
    },

    async mergeDeleting(): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          stagingDeletingTable,
          ["id", "eserviceId"],
          false
        );
        await conn.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging deleting table ${stagingDeletingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(
          `TRUNCATE TABLE ${stagingDeletingTable}_${config.mergeTableSuffix};`
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning deleting staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}

export type EserviceRiskAnalysisRepository = ReturnType<
  typeof eserviceRiskAnalysisRepository
>;
