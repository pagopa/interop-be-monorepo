/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../db/db.js";
import { DeletingTableConfigMap } from "../model/db.js";
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
              CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName}_${config.mergeTableSuffix} (
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
    async setupStagingDeletingTables(
      configs: DeletingTableConfigMap[]
    ): Promise<void> {
      try {
        await Promise.all(
          configs.map(({ name, columns }) => {
            const columnDefs = columns
              .map((key) => `${String(key)} VARCHAR(255)`)
              .concat("deleted BOOLEAN NOT NULL")
              .join(",\n  ");

            const primaryKey = `PRIMARY KEY (${columns.join(", ")})`;

            const query = `
              CREATE TEMPORARY TABLE IF NOT EXISTS ${name}_${config.mergeTableSuffix} (
                ${columnDefs},
                ${primaryKey}
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
