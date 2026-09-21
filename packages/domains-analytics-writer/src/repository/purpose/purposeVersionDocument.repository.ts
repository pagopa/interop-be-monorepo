/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeVersionDocumentSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const purposeVersionDocumentRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_version_document,
    schema: PurposeVersionDocumentSchema,
    keyColumns: ["id", "purposeVersionId"],
  });
