/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { ClientDbTable, DeletingDbTable } from "../../model/db/index.js";
import { ClientPurposeSchema } from "pagopa-interop-kpi-models";
import { ClientPurposeDeletingSchema } from "../../model/authorization/clientPurpose.js";

export const clientPurposeRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: ClientDbTable.client_purpose,
    schema: ClientPurposeSchema,
    keyColumns: ["clientId", "purposeId"],
    deleting: {
      deletingTableName: DeletingDbTable.client_purpose_deleting_table,
      deletingSchema: ClientPurposeDeletingSchema,
      useIdAsSourceDeleteKey: false,
    },
  });
