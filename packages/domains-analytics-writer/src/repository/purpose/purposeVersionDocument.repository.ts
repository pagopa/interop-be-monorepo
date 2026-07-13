/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { PurposeVersionDocumentSchema } from "pagopa-interop-kpi-models";

export const purposeVersionDocumentRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_version_document,
    schema: PurposeVersionDocumentSchema,
    keyColumns: ["id", "purposeVersionId"],
  });
