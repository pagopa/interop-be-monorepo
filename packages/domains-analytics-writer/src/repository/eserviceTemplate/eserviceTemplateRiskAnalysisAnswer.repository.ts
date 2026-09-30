/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceTemplateRiskAnalysisAnswerSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceTemplateRiskAnalysisAnswerRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
    schema: EserviceTemplateRiskAnalysisAnswerSchema,
    keyColumns: ["id"],
  });
