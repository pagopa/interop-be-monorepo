/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AgreementStampSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const agreementStampRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement_stamp,
    schema: AgreementStampSchema,
    keyColumns: ["agreementId", "kind"],
  });
