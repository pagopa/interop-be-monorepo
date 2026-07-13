/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateMergeQuery,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  DeletingDbTable,
  ClientDbTable,
  ClientDbTablePartialTable,
} from "../../model/db/index.js";
import { ClientKeySchema } from "pagopa-interop-kpi-models";
import {
  ClientKeyDeletingSchema,
  ClientKeyUserMigrationSchema,
} from "../../model/authorization/clientKey.js";
import { createRepository } from "../createRepository.js";

export function clientKeyRepository(conn: DBConnection) {
  const base = createRepository(conn, {
    tableName: ClientDbTable.client_key,
    schema: ClientKeySchema,
    keyColumns: ["clientId", "kid"],
    deleting: {
      deletingTableName: DeletingDbTable.client_key_deleting_table,
      deletingSchema: ClientKeyDeletingSchema,
      useIdAsSourceDeleteKey: false,
      physicalDelete: false,
      additionalKeysToUpdate: ["deleted_at"],
    },
  });

  const schemaName = config.dbSchemaName;
  const tableName = ClientDbTable.client_key;
  const keyRelationshipTableName =
    ClientDbTablePartialTable.key_relationship_migrated;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    ...base,

    async insertKeyUserMigration(
      t: ITask<unknown>,
      pgp: IMain,
      records: ClientKeyUserMigrationSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          keyRelationshipTableName,
          ClientKeyUserMigrationSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(
            tableName,
            ["clientId", "kid", "userId"],
            keyRelationshipTableName
          )
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async mergeKeyUserMigration(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          ClientKeyUserMigrationSchema,
          schemaName,
          tableName,
          ["clientId", "kid", "userId"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },
  };
}
