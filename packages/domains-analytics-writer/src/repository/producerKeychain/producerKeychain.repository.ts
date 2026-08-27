/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ProducerKeychainSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { ProducerKeychainDeletingSchema } from "../../model/authorization/producerKeychain.js";
import {
  ProducerKeychainDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

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
