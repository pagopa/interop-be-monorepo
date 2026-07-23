import { DB, FileManager, initFileManager } from "pagopa-interop-commons";
import {
  resetTestDatabase,
  setupEventstoreTestDatabase,
  setupMinioTestBucket,
  setupReadmodelTestDatabase,
  setupTenantKindHistoryTestDatabase,
  TestDrizzleDb,
} from "pagopa-interop-commons-test";
import {
  CatalogReadModelService,
  EServiceTemplateReadModelService,
  TenantReadModelService,
  catalogReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  attributeInReadmodelAttribute,
  delegationInReadmodelDelegation,
  eserviceInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { tenantKindHistory } from "pagopa-interop-tenant-kind-history-db-models";
import { afterAll, afterEach, beforeAll, inject } from "vitest";

import { config } from "../../src/config/config.js";
import {
  CatalogService,
  catalogServiceBuilder,
} from "../../src/services/catalogService.js";
import {
  ReadModelServiceSQL,
  readModelServiceBuilderSQL,
} from "../../src/services/readModelServiceSQL.js";

let postgresDB: DB; // event-store database
let readModelDB: TestDrizzleDb;
let tenantKindHistoryDB: TestDrizzleDb;

export let testBucket: string;
export let fileManager: FileManager;
let cleanAfterEach: () => Promise<void>;
let cleanupAfterAll: () => Promise<void>;
let catalogReadModelServiceSQL: CatalogReadModelService;
let tenantReadModelServiceSQL: TenantReadModelService;
let eserviceTemplateReadModelServiceSQL: EServiceTemplateReadModelService;
let readModelService: ReadModelServiceSQL;
let catalogService: CatalogService;

async function resetTestDatabases() {
  await Promise.all([
    postgresDB.none(
      "TRUNCATE TABLE catalog.events, eservice_template.events RESTART IDENTITY" // TODO: why eservice template
    ),
    resetTestDatabase(
      readModelDB,
      eserviceInReadmodelCatalog,
      tenantInReadmodelTenant,
      attributeInReadmodelAttribute,
      delegationInReadmodelDelegation,
      eserviceTemplateInReadmodelEserviceTemplate,
      agreementInReadmodelAgreement
    ),
    resetTestDatabase(tenantKindHistoryDB, tenantKindHistory),
  ]);
}

beforeAll(async () => {
  const connectionString = inject("POSTGRES_CONNECTION_STRING");

  postgresDB = await setupEventstoreTestDatabase(connectionString, "catalog");
  readModelDB = await setupReadmodelTestDatabase(connectionString);
  tenantKindHistoryDB =
    await setupTenantKindHistoryTestDatabase(connectionString);

  const setup = await setupMinioTestBucket(
    inject("MINIO_CONNECTION_STRING"),
    config
  );
  testBucket = setup.bucket;
  cleanAfterEach = setup.cleanAfterEach;
  cleanupAfterAll = setup.cleanupAfterAll;

  const minioUrl = new URL(setup.connectionString);
  fileManager = initFileManager({
    s3CustomServer: true as const,
    s3ServerHost: `${minioUrl.protocol}//${minioUrl.hostname}`,
    s3ServerPort: Number(minioUrl.port),
    logLevel: "info",
  });

  catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
  tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
  eserviceTemplateReadModelServiceSQL =
    eserviceTemplateReadModelServiceBuilder(readModelDB);
  readModelService = readModelServiceBuilderSQL(
    readModelDB,
    catalogReadModelServiceSQL,
    tenantReadModelServiceSQL,
    eserviceTemplateReadModelServiceSQL,
    tenantKindHistoryDB
  );
  catalogService = catalogServiceBuilder(
    postgresDB,
    readModelService,
    fileManager
  );
});

afterEach(async () => {
  await Promise.all([resetTestDatabases(), cleanAfterEach()]);
});

afterAll(async () => {
  await Promise.all([
    postgresDB.$pool.end(),
    readModelDB.$client.end(),
    tenantKindHistoryDB.$client.end(),
    cleanupAfterAll(),
  ]);
});

export {
  postgresDB,
  readModelDB,
  tenantKindHistoryDB,
  catalogService,
  readModelService,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  eserviceTemplateReadModelServiceSQL,
};
