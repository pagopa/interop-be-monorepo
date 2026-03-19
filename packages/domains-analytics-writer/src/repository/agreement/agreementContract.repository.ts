/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { AgreementContractSchema } from "../../model/agreement/agreementContract.js";

export const agreementContractRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement_contract,
    schema: AgreementContractSchema,
    keyColumns: ["id", "agreementId"],
  });
