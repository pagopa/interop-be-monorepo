/* eslint-disable no-console */
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

const readModelServiceSQL = catalogReadModelServiceBuilderSQL(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilderSQL(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilderSQL(readModelDB);

async function main(): Promise<void> {
  const eservices = await readModelService.getAllReadModelEServices();
  const eservicesPostgres = await readModelServiceSQL.getAllEServices();

  compare({
    collectionItems: eservices,
    postgresItems: eservicesPostgres,
    schema: "eservices",
    loggerInstance,
  });

  const attributes = await readModelService.getAllReadModelAttributes();
  const attributesPostgres =
    await attributeReadModelServiceSQL.getAllAttributes();

  compare({
    collectionItems: attributes,
    postgresItems: attributesPostgres,
    schema: "attributes",
    loggerInstance,
  });

  const tenants = await readModelService.getAllReadModelTenants();
  const tenantsPostgres = await tenantReadModelServiceSQL.getAllTenants();

  compare({
    collectionItems: tenants,
    postgresItems: tenantsPostgres,
    schema: "tenants",
    loggerInstance,
  });
}

await main();
