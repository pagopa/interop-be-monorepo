/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { TenantDbTable } from "../../model/db/index.js";
import { TenantVerifiedAttributeVerifierSchema } from "../../model/tenant/tenantVerifiedAttributeVerifier.js";

export const tenantVerifiedAttributeVerifierRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_verified_attribute_verifier,
    schema: TenantVerifiedAttributeVerifierSchema,
    keyColumns: ["tenantId", "tenantVerifiedAttributeId"],
  });
