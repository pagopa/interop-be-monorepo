/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { TenantDbTable } from "../../model/db/index.js";
import { TenantVerifiedAttributeSchema } from "pagopa-interop-kpi-models";

export const tenantVerifiedAttributeRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_verified_attribute,
    schema: TenantVerifiedAttributeSchema,
    keyColumns: ["attributeId", "tenantId"],
  });
