/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { EserviceTemplateRiskAnalysisAnswerSchema } from "../../model/eserviceTemplate/eserviceTemplateRiskAnalysisAnswer.js";

export const eserviceTemplateRiskAnalysisAnswerRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
    schema: EserviceTemplateRiskAnalysisAnswerSchema,
    keyColumns: ["id"],
  });
