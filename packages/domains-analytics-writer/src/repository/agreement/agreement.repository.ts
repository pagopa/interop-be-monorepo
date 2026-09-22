/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AgreementSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { AgreementDeletingSchema } from "../../model/agreement/agreement.js";
import { AgreementDbTable, DeletingDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

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
