/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import {
  AgreementCollection,
  EServiceCollection,
  FileManager,
  ReadModelRepository,
  TenantCollection,
  initDB,
  initFileManager,
  logger,
} from "pagopa-interop-commons";
import {
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  mongoDBContainer,
  postgreSQLContainer,
} from "pagopa-interop-commons-test/index.js";
import { IDatabase } from "pg-promise";
import { StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll } from "vitest";
import {
  AgreementService,
  agreementServiceBuilder,
} from "../src/services/agreementService.js";
import { agreementQueryBuilder } from "../src/services/readmodel/agreementQuery.js";
import { attributeQueryBuilder } from "../src/services/readmodel/attributeQuery.js";
import { eserviceQueryBuilder } from "../src/services/readmodel/eserviceQuery.js";
import { readModelServiceBuilder } from "../src/services/readmodel/readModelService.js";
import { tenantQueryBuilder } from "../src/services/readmodel/tenantQuery.js";
import { config } from "../src/utilities/config.js";

export let agreements: AgreementCollection;
export let eservices: EServiceCollection;
export let tenants: TenantCollection;
export let readModelService: ReturnType<typeof readModelServiceBuilder>;
export let agreementService: AgreementService;
export let postgresDB: IDatabase<unknown>;
export let startedPostgreSqlContainer: StartedTestContainer;
export let startedMongodbContainer: StartedTestContainer;
export let fileManager: FileManager;

beforeAll(async () => {
  startedPostgreSqlContainer = await postgreSQLContainer(config).start();
  startedMongodbContainer = await mongoDBContainer(config).start();

  config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
    TEST_POSTGRES_DB_PORT
  );
  config.readModelDbPort =
    startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);

  const readModelRepository = ReadModelRepository.init(config);
  agreements = readModelRepository.agreements;
  eservices = readModelRepository.eservices;
  tenants = readModelRepository.tenants;

  readModelService = readModelServiceBuilder(readModelRepository);
  const eserviceQuery = eserviceQueryBuilder(readModelService);
  const agreementQuery = agreementQueryBuilder(readModelService);
  const tenantQuery = tenantQueryBuilder(readModelService);
  const attributeQuery = attributeQueryBuilder(readModelService);

  postgresDB = initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  });

  if (!postgresDB) {
    logger.error("postgresDB is undefined!!");
  }

  // TODO: Setup MinIO test container when testing functionalities that require file storage
  fileManager = initFileManager(config);
  agreementService = agreementServiceBuilder(
    postgresDB,
    agreementQuery,
    tenantQuery,
    eserviceQuery,
    attributeQuery,
    fileManager
  );
});

afterEach(async () => {
  await agreements.deleteMany({});
  await eservices.deleteMany({});
  await tenants.deleteMany({});

  await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
  await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
});

afterAll(async () => {
  await startedPostgreSqlContainer.stop();
  await startedMongodbContainer.stop();
});
