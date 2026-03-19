/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { TenantDbTable } from "../../model/db/index.js";
import { TenantCertifiedAttributeSchema } from "pagopa-interop-kpi-models";

export const tenantCertifiedAttributeRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_certified_attribute,
    schema: TenantCertifiedAttributeSchema,
    keyColumns: ["attributeId", "tenantId"],
  });
