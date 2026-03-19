/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import {
  ProducerKeychainDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";
import {
  ProducerKeychainSchema,
  ProducerKeychainDeletingSchema,
} from "../../model/authorization/producerKeychain.js";

export const producerKeychainRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: ProducerKeychainDbTable.producer_keychain,
    schema: ProducerKeychainSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.producer_keychain_deleting_table,
      deletingSchema: ProducerKeychainDeletingSchema,
      useIdAsSourceDeleteKey: false,
      physicalDelete: false,
    },
  });
