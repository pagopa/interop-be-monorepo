/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { TenantMailSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { TenantDbTable, DeletingDbTable } from "../../model/db/index.js";
import { TenantMailDeletingSchema } from "../../model/tenant/tenantMail.js";
import { createRepository } from "../createRepository.js";

export const tenantMailRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: TenantDbTable.tenant_mail,
    schema: TenantMailSchema,
    keyColumns: ["id", "tenantId", "createdAt"],
    deleting: {
      deletingTableName: DeletingDbTable.tenant_mail_deleting_table,
      deletingSchema: TenantMailDeletingSchema,
      deletingKeyColumns: ["id", "tenantId"],
      useIdAsSourceDeleteKey: false,
    },
  });
