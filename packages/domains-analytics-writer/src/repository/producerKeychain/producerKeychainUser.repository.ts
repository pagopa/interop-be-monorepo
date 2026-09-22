/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ProducerKeychainUserSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { ProducerKeychainDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const producerKeychainUserRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: ProducerKeychainDbTable.producer_keychain_user,
    schema: ProducerKeychainUserSchema,
    keyColumns: ["producerKeychainId", "userId"],
  });
