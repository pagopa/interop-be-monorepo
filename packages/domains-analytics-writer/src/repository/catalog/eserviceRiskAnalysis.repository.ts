/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { CatalogDbTable } from "../../model/db/index.js";
import { EserviceRiskAnalysisSchema } from "pagopa-interop-kpi-models";

export const eserviceRiskAnalysisRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_risk_analysis,
    schema: EserviceRiskAnalysisSchema,
    keyColumns: ["id", "eserviceId"],
  });
