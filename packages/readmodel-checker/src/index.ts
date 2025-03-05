import { z } from "zod";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  logger,
  ReadModelDbConfig,
  ReadModelRepository,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import {
  catalogReadModelServiceBuilderSQL,
  attributeReadModelServiceBuilderSQL,
  tenantReadModelServiceBuilderSQL,
  agreementReadModelServiceBuilderSQL,
  purposeReadModelServiceBuilderSQL,
  clientReadModelServiceBuilderSQL,
  clientJWKKeyReadModelServiceBuilder,
  producerKeychainReadModelServiceBuilder,
  producerJWKKeyreadModelServiceBuilder,
  delegationReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { compare } from "./utils.js";

const Config = ReadModelDbConfig.and(ReadModelSQLDbConfig);

type Config = z.infer<typeof Config>;

const config: Config = Config.parse(process.env);

const readModelRepository = ReadModelRepository.init(config);

const readModelService = readModelServiceBuilder(readModelRepository);

const loggerInstance = logger({
  serviceName: "readmodel-checker",
  correlationId: generateId<CorrelationId>(),
});

const pool = new Pool({
  host: config.readModelSQLDbHost,
  port: config.readModelSQLDbPort,
  database: config.readModelSQLDbName,
  user: config.readModelSQLDbUsername,
  password: config.readModelSQLDbPassword,
  ssl: config.readModelSQLDbUseSSL,
});

const readModelDB = drizzle({ client: pool });

const catalogReadModelServiceSQL =
  catalogReadModelServiceBuilderSQL(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilderSQL(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilderSQL(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilderSQL(readModelDB);
const purposeReadModelServiceSQL =
  purposeReadModelServiceBuilderSQL(readModelDB);
const clientReadModelServiceSQL = clientReadModelServiceBuilderSQL(readModelDB);
const clientKeyReadModelServiceSQL =
  clientJWKKeyReadModelServiceBuilder(readModelDB);
const producerKeychainReadModelServiceSQL =
  producerKeychainReadModelServiceBuilder(readModelDB);
const producerKeychainKeyReadModelServiceSQL =
  producerJWKKeyreadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);

async function main(): Promise<void> {
  // CATALOG
  const eservices = await readModelService.getAllReadModelEServices();
  const eservicesPostgres = await catalogReadModelServiceSQL.getAllEServices();
  compare({
    collectionItems: eservices,
    postgresItems: eservicesPostgres,
    schema: "eservices",
    loggerInstance,
  });

  // ATTRIBUTE
  const attributes = await readModelService.getAllReadModelAttributes();
  const attributesPostgres =
    await attributeReadModelServiceSQL.getAllAttributes();
  compare({
    collectionItems: attributes,
    postgresItems: attributesPostgres,
    schema: "attributes",
    loggerInstance,
  });

  // TENANT
  const tenants = await readModelService.getAllReadModelTenants();
  const tenantsPostgres = await tenantReadModelServiceSQL.getAllTenants();
  compare({
    collectionItems: tenants,
    postgresItems: tenantsPostgres,
    schema: "tenants",
    loggerInstance,
  });

  // AGREEMENT
  const agreements = await readModelService.getAllReadModelAgreements();
  const agreementsPostgres =
    await agreementReadModelServiceSQL.getAllAgreements();
  compare({
    collectionItems: agreements,
    postgresItems: agreementsPostgres,
    schema: "agreements",
    loggerInstance,
  });

  // PURPOSE
  const purposes = await readModelService.getAllReadModelPurposes();
  const purposesPostgres = await purposeReadModelServiceSQL.getAllPurposes();
  compare({
    collectionItems: purposes,
    postgresItems: purposesPostgres,
    schema: "purposes",
    loggerInstance,
  });

  // CLIENT
  const clients = await readModelService.getAllReadModelClients();
  const clientsPostgres = await clientReadModelServiceSQL.getAllClients();
  compare({
    collectionItems: clients,
    postgresItems: clientsPostgres,
    schema: "clients",
    loggerInstance,
  });

  // CLIENT JWK KEY
  const keys = await readModelService.getAllReadModelClientJWKKey();
  const keysPostgres = await clientKeyReadModelServiceSQL.getAllClientJWKKeys();
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
    await producerKeychainReadModelServiceSQL.getAllProducerKeychains();
  compare({
    collectionItems: producerKeychains,
    postgresItems: producerKeychainsPostgres,
    schema: "producer keychains",
    loggerInstance,
  });

  // PRODUCER KEYCHAIN JWK KEY
  const producerKeys = await readModelService.getAllReadModelProducerJWKKeys();
  const producerKeysPostgres =
    await producerKeychainKeyReadModelServiceSQL.getAllProducerJWKKeys();
  compare({
    collectionItems: producerKeys,
    postgresItems: producerKeysPostgres,
    schema: "producer keychain JWKkeys",
    loggerInstance,
  });

  // DELEGATION
  const delegations = await readModelService.getAllReadModelDelegations();
  const delegationsPostgres =
    await delegationReadModelServiceSQL.getAllDelegations();
  compare({
    collectionItems: delegations,
    postgresItems: delegationsPostgres,
    schema: "delegations",
    loggerInstance,
  });
}

await main();
