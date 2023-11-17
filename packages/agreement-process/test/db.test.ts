/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  EServiceCollection,
  ReadModelRepository,
  TenantCollection,
  getMongodbContainer,
  getPostgreSqlContainer,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import { config } from "../src/utilities/config.js";
import { ReadModelService } from "../src/services/readModelService.js";
import { AgreementService } from "../src/services/agreementService.js";

describe("database test", async () => {
  let agreements: AgreementCollection;
  let eservices: EServiceCollection;
  let tenants: TenantCollection;
  let readModelService: ReadModelService;
  let agreementService: AgreementService;
  let postgresDB: IDatabase<unknown>;

  beforeAll(async () => {
    const postgreSqlContainer = await getPostgreSqlContainer({
      dbName: config.eventStoreDbName,
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
    }).start();

    const mongodbContainer = await getMongodbContainer({
      dbName: config.readModelDbName,
      username: config.readModelDbUsername,
      password: config.readModelDbPassword,
    }).start();

    config.eventStoreDbPort = postgreSqlContainer.getMappedPort(5432);
    config.readModelDbPort = mongodbContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    agreements = readModelRepository.agreements;
    eservices = readModelRepository.eservices;
    tenants = readModelRepository.tenants;

    readModelService = new ReadModelService(config);
    agreementService = new AgreementService(readModelService, config);

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
    // await postgresDB.none("TRUNCATE TABLE tenant.events RESTART IDENTITY");
  });

  describe("TO DO", () => {
    it("TO DO", () => {
      expect(1).toBe(1);
    });
  });
});
