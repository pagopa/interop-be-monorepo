/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { ClientDbTable, DeletingDbTable } from "../../model/db/index.js";
import {
  ClientSchema,
  ClientDeletingSchema,
} from "../../model/authorization/client.js";

export const clientRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: ClientDbTable.client,
    schema: ClientSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.client_deleting_table,
      deletingSchema: ClientDeletingSchema,
      physicalDelete: false,
    },
  });
