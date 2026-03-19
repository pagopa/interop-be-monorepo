/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { DelegationDbTable } from "../../model/db/index.js";
import { DelegationStampSchema } from "../../model/delegation/delegationStamp.js";

export const delegationStampRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: DelegationDbTable.delegation_stamp,
    schema: DelegationStampSchema,
    keyColumns: ["delegationId", "kind"],
  });
