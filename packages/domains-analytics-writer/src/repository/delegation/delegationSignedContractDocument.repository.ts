/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { DelegationDbTable } from "../../model/db/index.js";
import { DelegationSignedContractDocumentSchema } from "../../model/delegation/delegationSignedContractDocument.js";

export const delegationSignedContractDocumentRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: DelegationDbTable.delegation_signed_contract_document,
    schema: DelegationSignedContractDocumentSchema,
    keyColumns: ["delegationId", "kind"],
  });
