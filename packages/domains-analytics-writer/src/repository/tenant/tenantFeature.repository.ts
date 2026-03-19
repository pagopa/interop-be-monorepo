/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { TenantDbTable } from "../../model/db/index.js";
import { TenantFeatureSchema } from "../../model/tenant/tenantFeature.js";

export const tenantFeatureRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_feature,
    schema: TenantFeatureSchema,
    keyColumns: ["tenantId", "kind"],
  });
