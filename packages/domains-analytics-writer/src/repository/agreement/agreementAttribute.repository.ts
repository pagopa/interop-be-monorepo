/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { AgreementAttributeSchema } from "../../model/agreement/agreementAttribute.js";

export const agreementAttributeRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement_attribute,
    schema: AgreementAttributeSchema,
    keyColumns: ["agreementId", "attributeId"],
  });
