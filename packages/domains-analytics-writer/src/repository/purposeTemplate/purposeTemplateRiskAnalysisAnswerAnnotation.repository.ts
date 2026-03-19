/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeTemplateDbTable } from "../../model/db/index.js";
import { PurposeTemplateRiskAnalysisAnswerAnnotationSchema } from "../../model/purposeTemplate/purposeTemplateRiskAnalysisAnswerAnnotation.js";

export const purposeTemplateRiskAnalysisAnswerAnnotationRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName:
      PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation,
    schema: PurposeTemplateRiskAnalysisAnswerAnnotationSchema,
    keyColumns: ["id"],
  });
