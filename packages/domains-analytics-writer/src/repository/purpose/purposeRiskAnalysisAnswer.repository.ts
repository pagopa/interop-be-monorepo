/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { PurposeRiskAnalysisAnswerSchema } from "../../model/purpose/purposeRiskAnalysisAnswer.js";

export const purposeRiskAnalysisAnswerRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_risk_analysis_answer,
    schema: PurposeRiskAnalysisAnswerSchema,
    keyColumns: ["id", "purposeId"],
  });
