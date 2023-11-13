import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ReadModelRepository,
  getMongodbContainer,
  getPostgreSqlContainer,
  initDB,
} from "pagopa-interop-commons";
import { config } from "../src/utilities/config.js";

describe("database test", async () => {
  const postgresDB = initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  });

  beforeAll(async () => {
    await getPostgreSqlContainer({
      dbName: config.eventStoreDbName,
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      port: config.eventStoreDbPort,
    }).start();

    await getMongodbContainer({
      dbName: config.readModelDbName,
      username: config.readModelDbUsername,
      password: config.readModelDbPassword,
      port: config.readModelDbPort,
    }).start();
  });

  afterEach(async () => {
    const { eservices } = ReadModelRepository.init(config);
    await eservices.deleteMany({});

    await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
  });

  describe("TO DO", () => {
    it("TO DO", () => {
      expect(1).toBe(1);
    });
  });
});
