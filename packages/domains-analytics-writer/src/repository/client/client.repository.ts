/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ClientSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { ClientDeletingSchema } from "../../model/authorization/client.js";
import { ClientDbTable, DeletingDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

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
