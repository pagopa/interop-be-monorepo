/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AgreementAttributeSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const agreementAttributeRepo = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AgreementDbTable.agreement_attribute,
    schema: AgreementAttributeSchema,
    keyColumns: ["agreementId", "attributeId"],
  });
