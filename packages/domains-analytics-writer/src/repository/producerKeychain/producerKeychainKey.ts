/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateMergeDeleteQuery,
  generateMergeQuery,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";

import {
  DeletingDbTable,
  ProducerKeychainDbTable,
} from "../../model/db/index.js";

import {
  ProducerKeychainKeySchema,
  ProducerKeychainKeyDeletingSchema,
} from "../../model/authorization/producerKeychainKey.js";

export function producerKeychainKeyRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = ProducerKeychainDbTable.producer_keychain_key;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTableName =
    DeletingDbTable.producer_keychain_key_deleting_table;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: ProducerKeychainKeySchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, ProducerKeychainKeySchema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(tableName, ["producerKeychainId", "kid"])
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
          ProducerKeychainKeySchema,
          schemaName,
          tableName,
          ["producerKeychainId", "kid"]
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

    async insertDeleting(
      t: ITask<unknown>,
      pgp: IMain,
      records: ProducerKeychainKeyDeletingSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          deletingTableName,
          ProducerKeychainKeyDeletingSchema
        );
        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${stagingDeletingTableName}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          deletingTableName,
          ["producerKeychainId", "kid"],
          false,
          true
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging deletion flag from ${stagingDeletingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning deleting staging table ${stagingDeletingTableName}: ${error}`
        );
      }
    },
  };
}

export type ProducerKeychainKeyRepository = ReturnType<
  typeof producerKeychainKeyRepository
>;
