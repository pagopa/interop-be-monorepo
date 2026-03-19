/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { TenantDbTable } from "../../model/db/index.js";
import { TenantVerifiedAttributeRevokerSchema } from "../../model/tenant/tenantVerifiedAttributeRevoker.js";

export const tenantVerifiedAttributeRevokerRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_verified_attribute_revoker,
    schema: TenantVerifiedAttributeRevokerSchema,
    keyColumns: ["tenantId", "tenantVerifiedAttributeId"],
  });
