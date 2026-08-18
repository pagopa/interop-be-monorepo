/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { TenantRemoteIdSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { TenantDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const tenantRemoteIdRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_remote_id,
    schema: TenantRemoteIdSchema,
    keyColumns: ["tenantId", "origin"],
  });
