/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  EServiceCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer } from "testcontainers";
import { config } from "../src/utilities/config.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { agreementServiceBuilder } from "../src/services/agreementService.js";

describe("database test", async () => {
  let agreements: AgreementCollection;
  let eservices: EServiceCollection;
  let tenants: TenantCollection;
  let readModelService;
  let agreementService;
  let postgresDB: IDatabase<unknown>;

  beforeAll(async () => {
    const postgreSqlContainer = await new PostgreSqlContainer("postgres:14")
      .withUsername(config.eventStoreDbUsername)
      .withPassword(config.eventStoreDbPassword)
      .withDatabase(config.eventStoreDbName)
      .withCopyFilesToContainer([
        {
          source: "../../docker/event-store-init.sql",
          target: "/docker-entrypoint-initdb.d/01-init.sql",
        },
      ])
      .withExposedPorts(5432)
      .start();

    const mongodbContainer = await new GenericContainer("mongo:4.0.0")
      .withEnvironment({
        MONGO_INITDB_DATABASE: config.readModelDbName,
        MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
        MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
      })
      .withExposedPorts(27017)
      .start();

    config.eventStoreDbPort = postgreSqlContainer.getMappedPort(5432);
    config.readModelDbPort = mongodbContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    agreements = readModelRepository.agreements;
    eservices = readModelRepository.eservices;
    tenants = readModelRepository.tenants;

    readModelService = readModelServiceBuilder(config);
    agreementService = agreementServiceBuilder(config, readModelService);

    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
  });

  afterEach(async () => {
    await agreements.deleteMany({});
    await eservices.deleteMany({});
    await tenants.deleteMany({});

    await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
    await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
  });

  describe("TO DO", () => {
    it("TO DO", () => {
      expect(1).toBe(1);
    });
  });
});
