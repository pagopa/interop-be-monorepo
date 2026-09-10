/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { DeletingDbTable } from "../../model/db/deleting.js";
import { PurposeDbTable } from "../../model/db/purpose.js";
import { PurposeDeletingSchema } from "../../model/purpose/purpose.js";
import { createRepository } from "../createRepository.js";

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
