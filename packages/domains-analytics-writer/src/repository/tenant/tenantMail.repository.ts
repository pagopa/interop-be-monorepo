/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { TenantDbTable, DeletingDbTable } from "../../model/db/index.js";
import {
  TenantMailSchema,
  TenantMailDeletingSchema,
} from "../../model/tenant/tenantMail.js";

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
