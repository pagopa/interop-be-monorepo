/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ProducerKeychainEServiceSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { ProducerKeychainDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const producerKeychainEServiceRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: ProducerKeychainDbTable.producer_keychain_eservice,
    schema: ProducerKeychainEServiceSchema,
    keyColumns: ["producerKeychainId", "eserviceId"],
  });
