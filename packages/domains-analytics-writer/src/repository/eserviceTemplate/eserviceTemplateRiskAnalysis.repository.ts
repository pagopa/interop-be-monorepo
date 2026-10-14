/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceTemplateRiskAnalysisSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceTemplateRiskAnalysisRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_risk_analysis,
    schema: EserviceTemplateRiskAnalysisSchema,
    keyColumns: ["id"],
  });
