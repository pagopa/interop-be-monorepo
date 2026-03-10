/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateMergeQuery,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";

import { ProducerKeychainDbTable } from "../../model/db/index.js";
import { ProducerKeychainUserSchema } from "../../model/authorization/producerKeychainUser.js";

export function producerKeychainUserRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = ProducerKeychainDbTable.producer_keychain_user;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: ProducerKeychainUserSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, ProducerKeychainUserSchema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(tableName, [
            "producerKeychainId",
            "userId",
          ])
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          ProducerKeychainUserSchema,
          schemaName,
          tableName,
          ["producerKeychainId", "userId"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTableName}: ${error}`
        );
      }
    },
  };
}
