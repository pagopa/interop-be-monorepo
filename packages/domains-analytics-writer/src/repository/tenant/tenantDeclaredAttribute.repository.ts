/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { TenantDbTable } from "../../model/db/index.js";
import { TenantDeclaredAttributeSchema } from "../../model/tenant/tenantDeclaredAttribute.js";

export const tenantDeclaredAttributeRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_declared_attribute,
    schema: TenantDeclaredAttributeSchema,
    keyColumns: ["attributeId", "tenantId"],
  });
