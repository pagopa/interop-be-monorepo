/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { PurposeVersionSignedDocumentSchema } from "../../model/purpose/purposeVersionSignedDocument.js";

export const purposeVersionSignedDocumentRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_version_signed_document,
    schema: PurposeVersionSignedDocumentSchema,
    keyColumns: ["id", "purposeVersionId"],
  });
