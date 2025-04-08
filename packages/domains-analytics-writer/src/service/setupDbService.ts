/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../db/db.js";
import { AttributeDbtable, DeletingDbTable } from "../model/db.js";
import { setupStagingTablesError } from "../model/errors.js";

export interface SetupDbConfig {
  mergeTableSuffix: string;
  dbSchemaName: string;
}

export function setupDbServiceBuilder(
  conn: DBConnection,
  config: SetupDbConfig
) {
  return {
    async setupStagingTables(tableNames: AttributeDbtable[]): Promise<void> {
      try {
        await Promise.all(
          tableNames.map((tableName) => {
            const query = `
              CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName}${config.mergeTableSuffix} (
                LIKE ${config.dbSchemaName}.${tableName}
              );
            `;
            return conn.query(query);
          })
        );
      } catch (error: unknown) {
        throw setupStagingTablesError(error);
      }
    },

    async setupStagingDeletingByIdTables(
      deletingTableName: DeletingDbTable[]
    ): Promise<void> {
      try {
        await Promise.all(
          deletingTableName.map((deletingTableName) => {
            const query = `
            CREATE TEMPORARY TABLE IF NOT EXISTS ${deletingTableName} (
              id VARCHAR(36) PRIMARY KEY,
              deleted BOOLEAN NOT NULL
            );
          `;
            return conn.query(query);
          })
        );
      } catch (error: unknown) {
        throw setupStagingTablesError(error);
      }
    },
  };
}
