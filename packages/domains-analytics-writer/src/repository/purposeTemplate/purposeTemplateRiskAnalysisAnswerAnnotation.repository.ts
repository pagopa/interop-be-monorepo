/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeTemplateRiskAnalysisAnswerAnnotationSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { PurposeTemplateDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const purposeTemplateRiskAnalysisAnswerAnnotationRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName:
      PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation,
    schema: PurposeTemplateRiskAnalysisAnswerAnnotationSchema,
    keyColumns: ["id"],
  });
