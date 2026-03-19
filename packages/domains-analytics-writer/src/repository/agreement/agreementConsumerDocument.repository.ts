/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { AgreementDbTable, DeletingDbTable } from "../../model/db/index.js";
import {
  AgreementConsumerDocumentSchema,
  AgreementConsumerDocumentDeletingSchema,
} from "../../model/agreement/agreementConsumerDocument.js";

export const agreementConsumerDocumentRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement_consumer_document,
    schema: AgreementConsumerDocumentSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.agreement_deleting_table,
      deletingSchema: AgreementConsumerDocumentDeletingSchema,
    },
  });
