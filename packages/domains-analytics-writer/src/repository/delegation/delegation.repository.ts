/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DelegationSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { DelegationDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const delegationRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: DelegationDbTable.delegation,
    schema: DelegationSchema,
    keyColumns: ["id"],
  });
