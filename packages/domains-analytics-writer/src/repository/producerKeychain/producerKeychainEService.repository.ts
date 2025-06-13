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
  ProducerKeychainEServiceSchema,
  ProducerKeychainEServiceDeletingSchema,
} from "../../model/authorization/producerKeychainEService.js";

export function producerKeychainEServiceRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = ProducerKeychainDbTable.producer_keychain_eservice;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTableName =
    DeletingDbTable.producer_keychain_eservice_deleting_table;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: ProducerKeychainEServiceSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tableName,
          ProducerKeychainEServiceSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(tableName, [
            "producerKeychainId",
            "eserviceId",
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
          ProducerKeychainEServiceSchema,
          schemaName,
          tableName,
          ["producerKeychainId", "eserviceId"]
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
      records: ProducerKeychainEServiceDeletingSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          deletingTableName,
          ProducerKeychainEServiceDeletingSchema
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
          ["producerKeychainId", "eserviceId"],
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

export type ProducerKeychainEServiceRepository = ReturnType<
  typeof producerKeychainEServiceRepository
>;
