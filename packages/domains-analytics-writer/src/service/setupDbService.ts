/* eslint-disable @typescript-eslint/explicit-function-return-type */

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
        throw error; // to do errormapper
      }
    },
  };
}

export type SetupDBServiceService = ReturnType<typeof setupDbServiceBuilder>;
