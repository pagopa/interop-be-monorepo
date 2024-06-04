/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { afterAll, afterEach, beforeAll, describe } from "vitest";
import {
  AgreementCollection,
  EServiceCollection,
  PurposeCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import {
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  mongoDBContainer,
  postgreSQLContainer,
} from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";
import { config } from "../src/utilities/config.js";
import {
  PurposeService,
  purposeServiceBuilder,
} from "../src/services/purposeService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import { testGetPurposeById } from "./testGetPurposeById.js";
import { testGetRiskAnalysisDocument } from "./testGetRiskAnalysisDocument.js";
import { testDeletePurposeVersion } from "./testDeletePurposeVersion.js";
import { testRejectPurposeVersion } from "./testRejectPurposeVersion.js";
import { testUpdatePurpose } from "./testUpdatePurpose.js";
import { testDeletePurpose } from "./testDeletePurpose.js";
import { testArchivePurposeVersion } from "./testArchivePurposeVersion.js";
import { testSuspendPurposeVersion } from "./testSuspendPurposeVersion.js";
import { testGetPurposes } from "./testGetPurposes.js";
import { testCreatePurpose } from "./testCreatePurpose.js";
import { testCreateReversePurpose } from "./testCreateReversePurpose.js";
import { testClonePurpose } from "./testClonePurpose.js";
import { testGetRiskAnalysisConfigurationByVersion } from "./testGetRiskAnalysisConfigurationByVersion.js";
import { testGetLatestRiskAnalysisConfiguration } from "./testGetLatestRiskAnalysisConfiguration.js";

export let purposes: PurposeCollection;
export let eservices: EServiceCollection;
export let tenants: TenantCollection;
export let agreements: AgreementCollection;
export let readModelService: ReadModelService;
export let purposeService: PurposeService;
export let postgresDB: IDatabase<unknown>;

describe("Integration tests", async () => {
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

    const readModelRepository = ReadModelRepository.init(config);
    purposes = readModelRepository.purposes;
    eservices = readModelRepository.eservices;
    tenants = readModelRepository.tenants;
    agreements = readModelRepository.agreements;
    readModelService = readModelServiceBuilder(readModelRepository);
    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
    purposeService = purposeServiceBuilder(postgresDB, readModelService);
  });

  afterEach(async () => {
    await purposes.deleteMany({});
    await tenants.deleteMany({});
    await eservices.deleteMany({});
    await agreements.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE purpose.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
  });

  describe("Purpose service", () => {
    testGetPurposeById();
    testGetRiskAnalysisDocument();
    testDeletePurposeVersion();
    testRejectPurposeVersion();
    testUpdatePurpose();
    testDeletePurpose();
    testArchivePurposeVersion();
    testSuspendPurposeVersion();
    testGetPurposes();
    testCreatePurpose();
    testCreateReversePurpose();
    testClonePurpose();
    testGetRiskAnalysisConfigurationByVersion();
    testGetLatestRiskAnalysisConfiguration();
  });
});
