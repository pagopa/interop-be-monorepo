/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { AgreementDbTable, DeletingDbTable } from "../../model/db/index.js";
import {
  AgreementSchema,
  AgreementDeletingSchema,
} from "../../model/agreement/agreement.js";

export const agreementRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement,
    schema: AgreementSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.agreement_deleting_table,
      deletingSchema: AgreementDeletingSchema,
      physicalDelete: false,
    },
  });
