/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeTemplateDbTable } from "../../model/db/index.js";
import { PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema } from "../../model/purposeTemplate/purposeTemplateRiskAnalysisAnswerAnnotationDocument.js";

export const purposeTemplateRiskAnalysisAnswerAnnotationDocumentRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName:
      PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation_document,
    schema: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema,
    keyColumns: ["id"],
  });
