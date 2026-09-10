/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { PurposeTemplateDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const purposeTemplateRiskAnalysisAnswerAnnotationDocumentRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName:
      PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation_document,
    schema: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema,
    keyColumns: ["id"],
  });
