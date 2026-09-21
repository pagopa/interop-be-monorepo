/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeRiskAnalysisAnswerSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const purposeRiskAnalysisAnswerRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_risk_analysis_answer,
    schema: PurposeRiskAnalysisAnswerSchema,
    keyColumns: ["id", "purposeId"],
  });
