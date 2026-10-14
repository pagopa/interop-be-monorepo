/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceRiskAnalysisSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { CatalogDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceRiskAnalysisRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_risk_analysis,
    schema: EserviceRiskAnalysisSchema,
    keyColumns: ["id", "eserviceId"],
  });
