/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeTemplateDbTable } from "../../model/db/index.js";
import { PurposeTemplateRiskAnalysisFormSchema } from "../../model/purposeTemplate/purposeTemplateRiskAnalysisForm.js";

export const purposeTemplateRiskAnalysisFormRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeTemplateDbTable.purpose_template_risk_analysis_form,
    schema: PurposeTemplateRiskAnalysisFormSchema,
    keyColumns: ["purposeTemplateId"],
  });
