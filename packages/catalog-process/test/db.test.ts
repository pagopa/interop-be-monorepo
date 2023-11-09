import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";
// import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { config } from "../src/utilities/config.js";
import {
  ReadModelRepository,
  SingletonMongodbContainer,
} from "pagopa-interop-commons";
import { StartedTestContainer } from "testcontainers";

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

  let container: StartedTestContainer | undefined;

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

    container = await SingletonMongodbContainer.init()
      .start()
      .catch(() => undefined);
  });

  afterEach(async () => {
    const { eservices } = ReadModelRepository.init(config);
    await eservices.deleteMany({});

    // await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
  });

  afterAll(() => {
    if (container !== undefined) {
      container.stop();
    }
  });

  describe("TO DO", () => {
    it("TO DO", () => {
      expect(1).toBe(1);
    });
  });
});
