import { CorrelationId, generateId } from "pagopa-interop-models";
import { logger } from "pagopa-interop-commons";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { compare } from "./utils.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { config } from "./configs/config.js";
import { readModelServiceBuilderKPI } from "./services/readModelServiceKPI.js";

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

const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);
const readModelServiceKPI = readModelServiceBuilderKPI(readModelDB);

async function main(): Promise<void> {
  // CATALOG
  const eservices = await readModelServiceKPI.getAllEServices();
  const eservicesPostgres = await readModelServiceSQL.getAllEServices();
  compare({
    collectionItems: eservices,
    postgresItems: eservicesPostgres,
    schema: "eservices",
    loggerInstance,
  });

  // ESERVICE TEMPLATE
  const eserviceTemplates = await readModelServiceKPI.getAllEServiceTemplates();
  const eserviceTemplatesPostgres =
    await readModelServiceSQL.getAllEServiceTemplates();
  compare({
    collectionItems: eserviceTemplates,
    postgresItems: eserviceTemplatesPostgres,
    schema: "eservice templates",
    loggerInstance,
  });

  // ATTRIBUTE
  const attributes = await readModelServiceKPI.getAllAttributes();
  const attributesPostgres = await readModelServiceSQL.getAllAttributes();
  compare({
    collectionItems: attributes,
    postgresItems: attributesPostgres,
    schema: "attributes",
    loggerInstance,
  });

  // TENANT
  const tenants = await readModelServiceKPI.getAllTenants();
  const tenantsPostgres = await readModelServiceSQL.getAllTenants();
  compare({
    collectionItems: tenants,
    postgresItems: tenantsPostgres,
    schema: "tenants",
    loggerInstance,
  });

  // AGREEMENT
  const agreements = await readModelServiceKPI.getAllAgreements();
  const agreementsPostgres = await readModelServiceSQL.getAllAgreements();
  compare({
    collectionItems: agreements,
    postgresItems: agreementsPostgres,
    schema: "agreements",
    loggerInstance,
  });

  // PURPOSE
  const purposes = await readModelServiceKPI.getAllPurposes();
  const purposesPostgres = await readModelServiceSQL.getAllPurposes();
  compare({
    collectionItems: purposes,
    postgresItems: purposesPostgres,
    schema: "purposes",
    loggerInstance,
  });

  // CLIENT
  const clients = await readModelServiceKPI.getAllClients();
  const clientsPostgres = await readModelServiceSQL.getAllClients();
  compare({
    collectionItems: clients,
    postgresItems: clientsPostgres,
    schema: "clients",
    loggerInstance,
  });

  // CLIENT JWK KEY
  const keys = await readModelServiceKPI.getAllClientJWKKeys();
  const keysPostgres = await readModelServiceSQL.getAllClientJWKKeys();
  compare({
    collectionItems: keys,
    postgresItems: keysPostgres,
    schema: "JWKkeys",
    loggerInstance,
  });

  // PRODUCER KEYCHAIN
  const producerKeychains = await readModelServiceKPI.getAllProducerKeychains();
  const producerKeychainsPostgres =
    await readModelServiceSQL.getAllProducerKeychains();
  compare({
    collectionItems: producerKeychains,
    postgresItems: producerKeychainsPostgres,
    schema: "producer keychains",
    loggerInstance,
  });

  // PRODUCER KEYCHAIN JWK KEY
  const producerKeys = await readModelServiceKPI.getAllProducerJWKKeys();
  const producerKeysPostgres =
    await readModelServiceSQL.getAllProducerJWKKeys();
  compare({
    collectionItems: producerKeys,
    postgresItems: producerKeysPostgres,
    schema: "producer keychain JWKkeys",
    loggerInstance,
  });

  // DELEGATION
  const delegations = await readModelServiceKPI.getAllDelegations();
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
