import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { EventStoreConfig, ReadModelDbConfig } from "pagopa-interop-commons";
import { GenericContainer } from "testcontainers";

export const TEST_MONGO_DB_PORT = 27017;
export const TEST_POSTGRES_DB_PORT = 5432;

export const getMongodbContainer = (
  config: ReadModelDbConfig
): GenericContainer =>
  new GenericContainer("mongo:4.0.0")
    .withEnvironment({
      MONGO_INITDB_DATABASE: config.readModelDbHost,
      MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
      MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
    })
    .withExposedPorts(TEST_MONGO_DB_PORT);

export const getPostgreSqlContainer = (
  config: EventStoreConfig
): PostgreSqlContainer =>
  new PostgreSqlContainer("postgres:14")
    .withDatabase(config.eventStoreDbName)
    .withUsername(config.eventStoreDbUsername)
    .withPassword(config.eventStoreDbPassword)
    .withCopyFilesToContainer([
      {
        source: "../../docker/event-store-init.sql",
        target: "/docker-entrypoint-initdb.d/01-init.sql",
      },
    ])
    .withExposedPorts(TEST_POSTGRES_DB_PORT);
