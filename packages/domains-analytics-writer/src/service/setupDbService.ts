/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../db/db.js";
import { DeletingDbTableConfigMap, DomainDbTable } from "../model/db.js";
import { setupStagingTablesError } from "../model/errors.js";
import { getColumnName } from "../utils/sqlQueryHelper.js";
export interface SetupDbConfig {
  mergeTableSuffix: string;
  dbSchemaName: string;
}

export function setupDbServiceBuilder(
  conn: DBConnection,
  config: SetupDbConfig
) {
  return {
    async setupStagingTables(tableNames: DomainDbTable[]): Promise<void> {
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
      tables: DeletingDbTableConfigMap[]
    ): Promise<void> {
      try {
        await Promise.all(
          tables.map(({ name, columns }) => {
            const snakeCase = getColumnName(name);
            const columnDefs = columns
              .map((key) => `${snakeCase(key)} VARCHAR(255)`)
              .concat("deleted BOOLEAN NOT NULL")
              .join(",\n  ");

            const primaryKey = `PRIMARY KEY (${columns
              .map(snakeCase)
              .join(", ")})`;

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
