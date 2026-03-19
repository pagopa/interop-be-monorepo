/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { ClientDbTable, DeletingDbTable } from "../../model/db/index.js";
import {
  ClientUserSchema,
  ClientUserDeletingSchema,
} from "../../model/authorization/clientUser.js";

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
