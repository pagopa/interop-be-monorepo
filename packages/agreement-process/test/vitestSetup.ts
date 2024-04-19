/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */

import {
  ReadModelRepository,
  initDB,
  logger,
  initFileManager,
  AgreementCollection,
  EServiceCollection,
  FileManager,
  TenantCollection,
} from "pagopa-interop-commons";
import { beforeAll, afterEach, inject } from "vitest";
import { IDatabase } from "pg-promise";
import { StartedTestContainer } from "testcontainers";
import {
  AgreementService,
  agreementServiceBuilder,
} from "../src/services/agreementService.js";
import { agreementQueryBuilder } from "../src/services/readmodel/agreementQuery.js";
import { attributeQueryBuilder } from "../src/services/readmodel/attributeQuery.js";
import { eserviceQueryBuilder } from "../src/services/readmodel/eserviceQuery.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readmodel/readModelService.js";
import { tenantQueryBuilder } from "../src/services/readmodel/tenantQuery.js";
import type { AgreementProcessConfig } from "../src/utilities/config.js";

export let agreements: AgreementCollection;
export let eservices: EServiceCollection;
export let tenants: TenantCollection;
export let readModelService: ReadModelService;
export let agreementService: AgreementService;
export let postgresDB: IDatabase<unknown>;
export let startedPostgreSqlContainer: StartedTestContainer;
export let startedMongodbContainer: StartedTestContainer;
export let startedMinioContainer: StartedTestContainer;
export let fileManager: FileManager;

declare module "vitest" {
  export interface ProvidedContext {
    config: AgreementProcessConfig;
  }
}
const config = inject("config");
const s3OriginalBucket = config.s3Bucket;

beforeAll(async () => {
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

  // Some tests change the bucket name, so we need to reset it
  config.s3Bucket = s3OriginalBucket;
});
