/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { AgreementStampSchema } from "pagopa-interop-kpi-models";

export const agreementStampRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement_stamp,
    schema: AgreementStampSchema,
    keyColumns: ["agreementId", "kind"],
  });
