/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../db/db.js";
import {
  DeletingDbTableConfigMap,
  DomainDbTable,
  PartialDbTable,
} from "../model/db/index.js";
import {
  setupPartialStagingTablesError,
  setupStagingTablesError,
} from "../model/errors.js";
import { mapZodToSQLType } from "../utils/mapZodToSQLType.js";
import { getColumnNameMapper } from "../utils/sqlQueryHelper.js";
interface SetupDbConfig {
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
                _seq BIGINT GENERATED ALWAYS AS IDENTITY,
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
            const snakeCaseMapper = getColumnNameMapper(name);
            const columnDefs = columns
              .map((key) => {
                if (key === "deleted_at") {
                  return `${snakeCaseMapper(key)} TIMESTAMP WITH TIME ZONE`;
                }
                return `${snakeCaseMapper(key)} VARCHAR(255)`;
              })
              .concat("deleted BOOLEAN")
              .join(",\n  ");

            const primaryKey = `PRIMARY KEY (${columns
              .map(snakeCaseMapper)
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

    async setupPartialStagingTables(tables: PartialDbTable[]): Promise<void> {
      try {
        await Promise.all(
          tables.map((name) => {
            const snakeCaseMapper = getColumnNameMapper(name);
            const schema = PartialDbTable[name];

            const columnDefs = Object.entries(schema.shape)
              .map(([key, zodType]) => {
                const columnName = snakeCaseMapper(key);
                const sqlType = mapZodToSQLType(zodType);
                return `${columnName} ${sqlType}`;
              })
              .join(",\n  ");

            const query = `
              CREATE TEMPORARY TABLE IF NOT EXISTS ${name}_${config.mergeTableSuffix} (
               _seq BIGINT GENERATED ALWAYS AS IDENTITY,
              ${columnDefs}
          );
        `;

            return conn.query(query);
          })
        );
      } catch (error: unknown) {
        throw setupPartialStagingTablesError(error);
      }
    },
  };
}
