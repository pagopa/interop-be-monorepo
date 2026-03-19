/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { DelegationDbTable } from "../../model/db/index.js";
import { DelegationContractDocumentSchema } from "../../model/delegation/delegationContractDocument.js";

export const delegationContractDocumentRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: DelegationDbTable.delegation_contract_document,
    schema: DelegationContractDocumentSchema,
    keyColumns: ["delegationId", "kind"],
  });
