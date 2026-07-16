/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeRiskAnalysisReviewerSchema } from "pagopa-interop-kpi-models";
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeDbTable } from "../../model/db/index.js";

export const purposeRiskAnalysisReviewerRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_risk_analysis_reviewer,
    schema: PurposeRiskAnalysisReviewerSchema,
    keyColumns: ["purposeId", "reviewerId"],
  });
