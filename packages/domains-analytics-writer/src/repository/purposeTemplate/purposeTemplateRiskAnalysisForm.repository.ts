/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeTemplateRiskAnalysisFormSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { PurposeTemplateDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const purposeTemplateRiskAnalysisFormRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeTemplateDbTable.purpose_template_risk_analysis_form,
    schema: PurposeTemplateRiskAnalysisFormSchema,
    keyColumns: ["purposeTemplateId"],
  });
