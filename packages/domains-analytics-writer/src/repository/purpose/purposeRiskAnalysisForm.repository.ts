/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeRiskAnalysisFormSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const purposeRiskAnalysisFormRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_risk_analysis_form,
    schema: PurposeRiskAnalysisFormSchema,
    keyColumns: ["id", "purposeId"],
  });
