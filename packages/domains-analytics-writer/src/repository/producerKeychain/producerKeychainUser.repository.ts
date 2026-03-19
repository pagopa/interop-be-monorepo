/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { ProducerKeychainDbTable } from "../../model/db/index.js";
import { ProducerKeychainUserSchema } from "../../model/authorization/producerKeychainUser.js";

export const producerKeychainUserRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: ProducerKeychainDbTable.producer_keychain_user,
    schema: ProducerKeychainUserSchema,
    keyColumns: ["producerKeychainId", "userId"],
  });
