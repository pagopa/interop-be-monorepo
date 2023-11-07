import { afterEach, vi } from "vitest";
import { MongoDBContainer } from "@testcontainers/mongodb";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const mongodbContainer = await new MongoDBContainer("mongo:6.0.7")
  .withEnvironment({
    MONGO_INITDB_DATABASE: "readmodel",
  })
  .start();

const postgresqlContainer = await new PostgreSqlContainer("postgres:14")
  .withDatabase("event-store")
  .withCopyFilesToContainer([
    {
      source: "../../docker/event-store-init.sql",
      target: "/docker-entrypoint-initdb.d/01-init.sql",
    },
  ])
  .start();

vi.mock("./src/utilities/config", () => {
  return {
    config: {
      readModelDbHost: mongodbContainer.getHost(),
      readModelDbUsername: "root",
      readModelDbPassword: "example",
      readModelDbName: "readmodel",
      readModelDbPort: mongodbContainer.getMappedPort(27017),
      eventStoreDbHost: postgresqlContainer.getHost(),
      eventStoreDbName: postgresqlContainer.getDatabase(),
      eventStoreDbUsername: postgresqlContainer.getUsername(),
      eventStoreDbPassword: postgresqlContainer.getPassword(),
      eventStoreDbPort: postgresqlContainer.getMappedPort(5432),
      eventStoreDbSchema: "attributes",
      eventStoreDbUseSSL: "false",
    },
  };
});

afterEach(async () => {
  await mongodbContainer.stop();
  await postgresqlContainer.stop();
});
