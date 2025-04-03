import { DBConnection } from "../db/db.js";

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
        throw error;
      }
    },

    async setupStagingDeletingTables(tableNames: string[]): Promise<void> {
      try {
        await Promise.all(
          tableNames.map((tableName) => {
            const fullStagingTable = `${tableName}${config.mergeTableSuffix}`;
            const query = `
              CREATE TEMPORARY TABLE IF NOT EXISTS ${fullStagingTable} (
                id VARCHAR(36) PRIMARY KEY,
                deleted BOOLEAN NOT NULL
              );
            `;
            return conn.query(query);
          })
        );
      } catch (error: unknown) {
        throw error;
      }
    },
  };
}
