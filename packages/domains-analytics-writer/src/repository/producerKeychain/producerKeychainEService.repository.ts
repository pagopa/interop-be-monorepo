/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { ProducerKeychainDbTable } from "../../model/db/index.js";
import { ProducerKeychainEServiceSchema } from "../../model/authorization/producerKeychainEService.js";

export const producerKeychainEServiceRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: ProducerKeychainDbTable.producer_keychain_eservice,
    schema: ProducerKeychainEServiceSchema,
    keyColumns: ["producerKeychainId", "eserviceId"],
  });
