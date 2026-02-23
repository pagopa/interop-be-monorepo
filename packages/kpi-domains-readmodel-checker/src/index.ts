import { CorrelationId, generateId } from "pagopa-interop-models";
import { initDB, logger } from "pagopa-interop-commons";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { compare } from "./utils.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { config } from "./configs/config.js";
import {
  DBContext,
  readModelServiceBuilderKPI,
} from "./services/readModelServiceKPI.js";

const loggerInstance = logger({
  serviceName: "kpi-domains-readmodel-checker",
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

const analyticsPostgresDB = initDB({
  username: config.dbUsername,
  password: config.dbPassword,
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
  useSSL: config.dbUseSSL,
  schema: config.dbSchemaName,
});

const connection = await analyticsPostgresDB.connect();

export const dbContext: DBContext = {
  conn: connection,
  pgp: analyticsPostgresDB.$config.pgp,
};

const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);
const readModelServiceKPI = readModelServiceBuilderKPI(dbContext);

async function main(): Promise<void> {
  // CATALOG
  const eservices = await readModelServiceKPI.getAllEServices();
  const eservicesPostgres = await readModelServiceSQL.getAllEServices();
  compare({
    kpiItems: eservices,
    postgresItems: eservicesPostgres,
    schema: "eservices",
    loggerInstance,
  });

  // ESERVICE TEMPLATE
  const eserviceTemplates = await readModelServiceKPI.getAllEServiceTemplates();
  const eserviceTemplatesPostgres =
    await readModelServiceSQL.getAllEServiceTemplates();
  compare({
    kpiItems: eserviceTemplates,
    postgresItems: eserviceTemplatesPostgres,
    schema: "eservice templates",
    loggerInstance,
  });

  // ATTRIBUTE
  const attributes = await readModelServiceKPI.getAllAttributes();
  const attributesPostgres = await readModelServiceSQL.getAllAttributes();
  compare({
    kpiItems: attributes,
    postgresItems: attributesPostgres,
    schema: "attributes",
    loggerInstance,
  });

  // TENANT
  const tenants = await readModelServiceKPI.getAllTenants();
  const tenantsPostgres = await readModelServiceSQL.getAllTenants();
  compare({
    kpiItems: tenants,
    postgresItems: tenantsPostgres,
    schema: "tenants",
    loggerInstance,
  });

  // AGREEMENT
  const agreements = await readModelServiceKPI.getAllAgreements();
  const agreementsPostgres = await readModelServiceSQL.getAllAgreements();
  compare({
    kpiItems: agreements,
    postgresItems: agreementsPostgres,
    schema: "agreements",
    loggerInstance,
  });

  // PURPOSE
  const purposes = await readModelServiceKPI.getAllPurposes();
  const purposesPostgres = await readModelServiceSQL.getAllPurposes();
  compare({
    kpiItems: purposes,
    postgresItems: purposesPostgres,
    schema: "purposes",
    loggerInstance,
  });

  // CLIENT
  const clients = await readModelServiceKPI.getAllClients();
  const clientsPostgres = await readModelServiceSQL.getAllClients();
  compare({
    kpiItems: clients,
    postgresItems: clientsPostgres,
    schema: "clients",
    loggerInstance,
  });

  // PRODUCER KEYCHAIN
  const producerKeychains = await readModelServiceKPI.getAllProducerKeychains();
  const producerKeychainsPostgres =
    await readModelServiceSQL.getAllProducerKeychains();
  compare({
    kpiItems: producerKeychains,
    postgresItems: producerKeychainsPostgres,
    schema: "producer keychains",
    loggerInstance,
  });

  // DELEGATION
  const delegations = await readModelServiceKPI.getAllDelegations();
  const delegationsPostgres = await readModelServiceSQL.getAllDelegations();
  compare({
    kpiItems: delegations,
    postgresItems: delegationsPostgres,
    schema: "delegations",
    loggerInstance,
  });

  // PURPOSE TEMPLATE
  const purposeTemplates = await readModelServiceKPI.getAllPurposeTemplates();
  const purposeTemplatesPostgres =
    await readModelServiceSQL.getAllPurposeTemplates();
  compare({
    kpiItems: purposeTemplates,
    postgresItems: purposeTemplatesPostgres,
    schema: "purpose templates",
    loggerInstance,
  });

  process.exit();
}

await main();
