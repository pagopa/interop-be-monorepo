/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeVersionSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { DeletingDbTable } from "../../model/db/deleting.js";
import { PurposeDbTable } from "../../model/db/purpose.js";
import { PurposeVersionDeletingSchema } from "../../model/purpose/purposeVersion.js";
import { createRepository } from "../createRepository.js";

export const purposeVersionRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeDbTable.purpose_version,
    schema: PurposeVersionSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.purpose_deleting_table,
      deletingSchema: PurposeVersionDeletingSchema,
      physicalDelete: false,
    },
  });
