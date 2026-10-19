/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { TenantCertifiedDiscreteAttributeSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { TenantDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const tenantCertifiedDiscreteAttributeRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_certified_discrete_attribute,
    schema: TenantCertifiedDiscreteAttributeSchema,
    keyColumns: ["attributeId", "tenantId"],
  });
