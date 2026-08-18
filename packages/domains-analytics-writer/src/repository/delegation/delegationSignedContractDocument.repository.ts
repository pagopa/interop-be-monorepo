/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DelegationSignedContractDocumentSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { DelegationDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const delegationSignedContractDocumentRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: DelegationDbTable.delegation_signed_contract_document,
    schema: DelegationSignedContractDocumentSchema,
    keyColumns: ["delegationId", "kind"],
  });
