/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DelegationStampSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { DelegationDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const delegationStampRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: DelegationDbTable.delegation_stamp,
    schema: DelegationStampSchema,
    keyColumns: ["delegationId", "kind"],
  });
