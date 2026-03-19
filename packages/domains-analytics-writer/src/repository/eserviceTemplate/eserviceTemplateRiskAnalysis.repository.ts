/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { EserviceTemplateRiskAnalysisSchema } from "pagopa-interop-kpi-models";

export const eserviceTemplateRiskAnalysisRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_risk_analysis,
    schema: EserviceTemplateRiskAnalysisSchema,
    keyColumns: ["id"],
  });
