import { afterEach, beforeAll, describe, expect, it } from "vitest";
// import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer } from "testcontainers";
import { ReadModelRepository } from "pagopa-interop-commons";
import { config } from "../src/utilities/config.js";

describe("database test", async () => {
  // const postgresDB = initDB({
  //   username: config.eventStoreDbUsername,
  //   password: config.eventStoreDbPassword,
  //   host: config.eventStoreDbHost,
  //   port: config.eventStoreDbPort,
  //   database: config.eventStoreDbName,
  //   schema: config.eventStoreDbSchema,
  //   useSSL: config.eventStoreDbUseSSL,
  // });

  beforeAll(async () => {
    // await new PostgreSqlContainer("postgres:14")
    //   .withUsername(config.eventStoreDbUsername)
    //   .withPassword(config.eventStoreDbPassword)
    //   .withDatabase(config.eventStoreDbName)
    //   .withCopyFilesToContainer([
    //     {
    //       source: "../../docker/event-store-init.sql",
    //       target: "/docker-entrypoint-initdb.d/01-init.sql",
    //     },
    //   ])
    //   .withExposedPorts({ container: 5432, host: config.eventStoreDbPort })
    //   .withReuse()
    //   .start();

    await new GenericContainer("mongo:6.0.7")
      .withEnvironment({
        MONGO_INITDB_DATABASE: "readmodel",
        MONGO_INITDB_ROOT_USERNAME: "root",
        MONGO_INITDB_ROOT_PASSWORD: "example",
      })
      .withExposedPorts({ container: 27017, host: 27017 })
      .withReuse()
      .start();
  });

  afterEach(async () => {
    const { eservices } = ReadModelRepository.init(config);
    await eservices.deleteMany({});

    // await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
  });

  describe("TO DO", () => {
    it("TO DO", () => {
      expect(1).toBe(1);
    });
  });
});
