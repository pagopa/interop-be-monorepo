/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceRiskAnalysisSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceRiskAnalysisMapping,
  eserviceRiskAnalysisDeletingSchema,
  eserviceRiskAnalysisSchema,
} from "../../model/catalog/eserviceRiskAnalysis.js";
import { CatalogDbTable } from "../../model/db.js";

export function eserviceRiskAnalysisRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_risk_analysis;
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;
  const stagingDeletingTable = CatalogDbTable.deleting_by_id_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceRiskAnalysisSQL[]
    ): Promise<void> {
      const mapping: EserviceRiskAnalysisMapping = {
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

    async insertDeletingRiskAnalysis(
      t: ITask<unknown>,
      pgp: IMain,
      id: string
    ): Promise<void> {
      const mapping = {
        id: () => id,
        deleted: () => true,
      };
      const cs = buildColumnSet<{ id: string; deleted: boolean }>(
        pgp,
        mapping,
        stagingDeletingTable
      );
      try {
        await t.none(pgp.helpers.insert({ id, deleted: true }, cs));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },

    async insertDeletingByRiskAnalysisId(
      t: ITask<unknown>,
      pgp: IMain,
      risk_analysis_form_id: string
    ): Promise<void> {
      const mapping = {
        id: () => risk_analysis_form_id,
        deleted: () => true,
      };
      try {
        const cs = buildColumnSet<{
          id: string;
          deleted: boolean;
        }>(pgp, mapping, stagingDeletingTable);

        await t.none(
          pgp.helpers.insert({ risk_analysis_form_id, deleted: true }, cs)
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          eserviceRiskAnalysisSchema,
          schemaName,
          tableName,
          stagingTable,
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

    async deleteRiskAnalysis(
      t: ITask<unknown>,
      pgp: IMain,
      id: string
    ): Promise<void> {
      const mapping = {
        id: () => id,
        deleted: () => true,
      };
      const cs = buildColumnSet<{ id: string; deleted: boolean }>(
        pgp,
        mapping,
        stagingDeletingTable
      );
      try {
        await t.none(pgp.helpers.insert({ id, deleted: true }, cs));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          eserviceRiskAnalysisDeletingSchema,
          schemaName,
          tableName,
          stagingDeletingTable,
          "id",
          true
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingDeletingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}

export type EserviceRiskAnalysisRepository = ReturnType<
  typeof eserviceRiskAnalysisRepository
>;
