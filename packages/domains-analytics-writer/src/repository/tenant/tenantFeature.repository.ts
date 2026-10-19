/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { TenantFeatureSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { TenantDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const tenantFeatureRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_feature,
    schema: TenantFeatureSchema,
    keyColumns: ["tenantId", "kind"],
  });
