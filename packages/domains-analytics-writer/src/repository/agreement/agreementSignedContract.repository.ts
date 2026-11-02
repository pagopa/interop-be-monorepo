/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AgreementSignedContractSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const agreementSignedContractRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement_signed_contract,
    schema: AgreementSignedContractSchema,
    keyColumns: ["id", "agreementId"],
  });
