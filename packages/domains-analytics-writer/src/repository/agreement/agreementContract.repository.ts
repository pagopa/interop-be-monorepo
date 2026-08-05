/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AgreementContractSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const agreementContractRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement_contract,
    schema: AgreementContractSchema,
    keyColumns: ["id", "agreementId"],
  });
