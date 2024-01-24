import { GenericContainer, StartedTestContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { EventStoreConfig, ReadModelDbConfig } from "../index.js";

export const TETS_MONGO_DB_PORT = 27017;
export const TEST_MONGO_DB_VERSION = "mongo:4.0.0";

export const TEST_POSTGRES_DB_PORT = 5432;
export const TEST_POSTGRES_DB_VERSION = "postgres:14";

/**
 * Starts a MongoDB container for testing purposes.
 *
 * @param config - The configuration for the MongoDB container.
 * @returns A promise that resolves to the started test container.
 */
export const startMongoDBContainer = async (
  config: ReadModelDbConfig
): Promise<StartedTestContainer> =>
  await new GenericContainer(TEST_MONGO_DB_VERSION)
    .withEnvironment({
      MONGO_INITDB_DATABASE: config.readModelDbName,
      MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
      MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
    })
    .withExposedPorts(TETS_MONGO_DB_PORT)
    .start();

/**
 * Starts a PostgreSQL container for testing purposes.
 *
 * @param config - The configuration for the PostgreSQL container.
 * @returns A promise that resolves to the started test container.
 */
export const startPostgresDBContainer = async (
  config: EventStoreConfig
): Promise<StartedTestContainer> =>
  await new PostgreSqlContainer(TEST_POSTGRES_DB_VERSION)
    .withUsername(config.eventStoreDbUsername)
    .withPassword(config.eventStoreDbPassword)
    .withDatabase(config.eventStoreDbName)
    .withCopyFilesToContainer([
      {
        source: "../../docker/event-store-init.sql",
        target: "/docker-entrypoint-initdb.d/01-init.sql",
      },
    ])
    .withExposedPorts(TEST_POSTGRES_DB_PORT)
    .start();
