/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { TenantCertifiedAttributeSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { TenantDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const tenantCertifiedAttributeRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_certified_attribute,
    schema: TenantCertifiedAttributeSchema,
    keyColumns: ["attributeId", "tenantId"],
  });
