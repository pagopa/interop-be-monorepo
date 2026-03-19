/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { PurposeRiskAnalysisFormSchema } from "../../model/purpose/purposeRiskAnalysis.js";

export const purposeRiskAnalysisFormRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_risk_analysis_form,
    schema: PurposeRiskAnalysisFormSchema,
    keyColumns: ["id", "purposeId"],
  });
