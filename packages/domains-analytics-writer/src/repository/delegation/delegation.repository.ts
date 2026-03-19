/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { DelegationDbTable } from "../../model/db/index.js";
import { DelegationSchema } from "../../model/delegation/delegation.js";

export const delegationRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: DelegationDbTable.delegation,
    schema: DelegationSchema,
    keyColumns: ["id"],
  });
