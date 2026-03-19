/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { PurposeVersionStampSchema } from "../../model/purpose/purposeVersionStamp.js";

export const purposeVersionStampRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_version_stamp,
    schema: PurposeVersionStampSchema,
    keyColumns: ["purposeVersionId", "kind"],
  });
