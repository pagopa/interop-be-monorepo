/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeTemplateDbTable } from "../../model/db/index.js";
import { PurposeTemplateRiskAnalysisAnswerSchema } from "pagopa-interop-kpi-models";

export const purposeTemplateRiskAnalysisAnswerRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: PurposeTemplateDbTable.purpose_template_risk_analysis_answer,
    schema: PurposeTemplateRiskAnalysisAnswerSchema,
    keyColumns: ["id"],
  });
