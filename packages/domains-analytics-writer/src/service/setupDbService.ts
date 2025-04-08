/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../db/db.js";
import { DeletingDbTable } from "../model/db.js";
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
    async setupStagingTables(tableNames: string[]): Promise<void> {
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

    async setupStagingDeletingByIdTables(): Promise<void> {
      try {
        const query = `
            CREATE TEMPORARY TABLE IF NOT EXISTS ${DeletingDbTable.deleting_table} (
              id VARCHAR(36) PRIMARY KEY,
              deleted BOOLEAN NOT NULL
            );
          `;
        return conn.query(query);
      } catch (error: unknown) {
        throw setupStagingTablesError(error);
      }
    },
  };
}
