/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { TenantVerifiedAttributeRevokerSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { TenantDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const tenantVerifiedAttributeRevokerRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_verified_attribute_revoker,
    schema: TenantVerifiedAttributeRevokerSchema,
    keyColumns: ["tenantId", "tenantVerifiedAttributeId"],
  });
