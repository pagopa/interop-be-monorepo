/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ClientUserSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { ClientUserDeletingSchema } from "../../model/authorization/clientUser.js";
import { ClientDbTable, DeletingDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const clientUserRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: ClientDbTable.client_user,
    schema: ClientUserSchema,
    keyColumns: ["clientId", "userId"],
    deleting: {
      deletingTableName: DeletingDbTable.client_user_deleting_table,
      deletingSchema: ClientUserDeletingSchema,
      useIdAsSourceDeleteKey: false,
    },
  });
