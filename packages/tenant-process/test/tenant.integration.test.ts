/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { beforeAll, afterEach, describe, expect, it } from "vitest";
import {
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import {
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  mongoDBContainer,
  postgreSQLContainer,
} from "pagopa-interop-commons-test";
import { IDatabase } from "pg-promise";
import { StartedTestContainer } from "testcontainers";
import { config } from "../src/utilities/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  TenantService,
  tenantServiceBuilder,
} from "../src/services/tenantService.js";

describe("Integration tests", () => {
  let tenants: TenantCollection;
  let readModelService: ReadModelService;
  let tenantService: TenantService;
  let postgresDB: IDatabase<unknown>;
  let startedPostgreSqlContainer: StartedTestContainer;
  let startedMongodbContainer: StartedTestContainer;

  beforeAll(async () => {
    startedPostgreSqlContainer = await postgreSQLContainer(config).start();
    startedMongodbContainer = await mongoDBContainer(config).start();

    config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort =
      startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
    ({ tenants } = ReadModelRepository.init(config));
    readModelService = readModelServiceBuilder(config);
    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
    tenantService = tenantServiceBuilder(postgresDB, readModelService);
  });

  afterEach(async () => {
    await tenants.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE tenant.events RESTART IDENTITY");

    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
  });

  describe("tenantService", () => {
    describe("tenant creation", () => {
      it("TO DO", () => {
        expect(1).toBe(1);
      });
    });
  });
  describe("readModelService", () => {
    describe("getTenantById", () => {
      it("TO DO", () => {
        expect(2).toBe(2);
      });
    });
  });
});
