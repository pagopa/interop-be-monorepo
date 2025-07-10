import { CorrelationId, generateId } from "pagopa-interop-models";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { overallReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { compare } from "./utils.js";
import { config } from "./configs/config.js";

const readModelRepository = ReadModelRepository.init(config);

const readModelService = readModelServiceBuilder(readModelRepository);

const loggerInstance = logger({
  serviceName: "readmodel-checker",
  correlationId: generateId<CorrelationId>(),
});

const pool = new pg.Pool({
  host: config.readModelSQLDbHost,
  port: config.readModelSQLDbPort,
  database: config.readModelSQLDbName,
  user: config.readModelSQLDbUsername,
  password: config.readModelSQLDbPassword,
  ssl: config.readModelSQLDbUseSSL ? { rejectUnauthorized: false } : undefined,
});

const readModelDB = drizzle({ client: pool });

const readModelServiceSQL = overallReadModelServiceBuilder(readModelDB);

async function main(): Promise<void> {
  // CATALOG
  const eservices = await readModelService.getAllReadModelEServices();
  const eservicesPostgres = await readModelServiceSQL.getAllEServices();
  compare({
    collectionItems: eservices,
    postgresItems: eservicesPostgres,
    schema: "eservices",
    loggerInstance,
  });

  // ESERVICE TEMPLATE
  const eserviceTemplates =
    await readModelService.getAllReadModelEServiceTemplates();
  const eserviceTemplatesPostgres =
    await readModelServiceSQL.getAllEServiceTemplates();
  compare({
    collectionItems: eserviceTemplates,
    postgresItems: eserviceTemplatesPostgres,
    schema: "eservice templates",
    loggerInstance,
  });

  // ATTRIBUTE
  const attributes = await readModelService.getAllReadModelAttributes();
  const attributesPostgres = await readModelServiceSQL.getAllAttributes();
  compare({
    collectionItems: attributes,
    postgresItems: attributesPostgres,
    schema: "attributes",
    loggerInstance,
  });

  // TENANT
  const tenants = await readModelService.getAllReadModelTenants();
  const tenantsPostgres = await readModelServiceSQL.getAllTenants();
  compare({
    collectionItems: tenants,
    postgresItems: tenantsPostgres,
    schema: "tenants",
    loggerInstance,
  });

  // AGREEMENT
  const agreements = await readModelService.getAllReadModelAgreements();
  const agreementsPostgres = await readModelServiceSQL.getAllAgreements();
  compare({
    collectionItems: agreements,
    postgresItems: agreementsPostgres,
    schema: "agreements",
    loggerInstance,
  });

  // PURPOSE
  const purposes = await readModelService.getAllReadModelPurposes();
  const purposesPostgres = await readModelServiceSQL.getAllPurposes();
  compare({
    collectionItems: purposes,
    postgresItems: purposesPostgres,
    schema: "purposes",
    loggerInstance,
  });

  // CLIENT
  const clients = await readModelService.getAllReadModelClients();
  const clientsPostgres = await readModelServiceSQL.getAllClients();
  compare({
    collectionItems: clients,
    postgresItems: clientsPostgres,
    schema: "clients",
    loggerInstance,
  });

  // CLIENT JWK KEY
  const keys = await readModelService.getAllReadModelClientJWKKey();
  const keysPostgres = await readModelServiceSQL.getAllClientJWKKeys();
  compare({
    collectionItems: keys,
    postgresItems: keysPostgres,
    schema: "JWKkeys",
    loggerInstance,
  });

  // PRODUCER KEYCHAIN
  const producerKeychains =
    await readModelService.getAllReadModelProducerKeychains();
  const producerKeychainsPostgres =
    await readModelServiceSQL.getAllProducerKeychains();
  compare({
    collectionItems: producerKeychains,
    postgresItems: producerKeychainsPostgres,
    schema: "producer keychains",
    loggerInstance,
  });

  // PRODUCER KEYCHAIN JWK KEY
  const producerKeys = await readModelService.getAllReadModelProducerJWKKeys();
  const producerKeysPostgres =
    await readModelServiceSQL.getAllProducerJWKKeys();
  compare({
    collectionItems: producerKeys,
    postgresItems: producerKeysPostgres,
    schema: "producer keychain JWKkeys",
    loggerInstance,
  });

  // DELEGATION
  const delegations = await readModelService.getAllReadModelDelegations();
  const delegationsPostgres = await readModelServiceSQL.getAllDelegations();
  compare({
    collectionItems: delegations,
    postgresItems: delegationsPostgres,
    schema: "delegations",
    loggerInstance,
  });

  process.exit();
}

await main();
