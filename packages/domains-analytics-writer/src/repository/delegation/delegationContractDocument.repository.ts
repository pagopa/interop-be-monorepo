/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DelegationContractDocumentSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { DelegationDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const delegationContractDocumentRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: DelegationDbTable.delegation_contract_document,
    schema: DelegationContractDocumentSchema,
    keyColumns: ["delegationId", "kind"],
  });
