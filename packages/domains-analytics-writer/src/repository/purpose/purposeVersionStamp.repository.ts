/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeVersionStampSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { PurposeDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const purposeVersionStampRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_version_stamp,
    schema: PurposeVersionStampSchema,
    keyColumns: ["purposeVersionId", "kind"],
  });
