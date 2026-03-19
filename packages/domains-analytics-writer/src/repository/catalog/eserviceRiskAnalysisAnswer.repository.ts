/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { CatalogDbTable } from "../../model/db/index.js";
import { EserviceRiskAnalysisAnswerSchema } from "../../model/catalog/eserviceRiskAnalysisAnswer.js";

export const eserviceRiskAnalysisAnswerRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_risk_analysis_answer,
    schema: EserviceRiskAnalysisAnswerSchema,
    keyColumns: ["id", "eserviceId"],
  });
