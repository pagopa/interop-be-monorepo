/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeDbTable } from "../../model/db/purpose.js";
import { DeletingDbTable } from "../../model/db/deleting.js";
import {
  PurposeSchema,
  PurposeDeletingSchema,
} from "../../model/purpose/purpose.js";

export const purposeRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose,
    schema: PurposeSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.purpose_deleting_table,
      deletingSchema: PurposeDeletingSchema,
      physicalDelete: false,
    },
  });
