/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { AgreementSignedContractSchema } from "pagopa-interop-kpi-models";

export const agreementSignedContractRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement_signed_contract,
    schema: AgreementSignedContractSchema,
    keyColumns: ["id", "agreementId"],
  });
