/* eslint-disable no-console */
import { z } from "zod";
import isEqual from "lodash.isequal";
import { diff } from "json-diff";
import { CorrelationId, generateId, WithMetadata } from "pagopa-interop-models";
import {
  logger,
  ReadModelDbConfig,
  ReadModelRepository,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { readModelServiceBuilderSQL } from "pagopa-interop-readmodel";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readModelServiceBuilder } from "./services/readModelService.js";

const Config = ReadModelDbConfig.and(ReadModelSQLDbConfig);

type Config = z.infer<typeof Config>;

const config: Config = Config.parse(process.env);

function getIdentificationKey<T extends { id: string } | { kid: string }>(
  obj: T
): string {
  return "id" in obj ? obj.id : obj.kid;
}

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
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);
// const attributeReadModelServiceSQL =
//   attributeReadModelServiceBuilderSQL(readModelDB);

function compare<T extends { id: string } | { kid: string }>(
  collectionItems: Array<WithMetadata<T>>,
  postgresItems: Array<WithMetadata<T>>,
  schema: string
): void {
  if (postgresItems.length === 0) {
    loggerInstance.info(
      `Skipping checks for ${schema} schema because it's empty`
    );
  }

  const allIds = new Set(
    [...collectionItems, ...postgresItems].map((d) =>
      getIdentificationKey(d.data)
    )
  );
  const pairs = Array.from(allIds)
    .map((id) => [
      collectionItems.find((d) => getIdentificationKey(d.data) === id),
      postgresItems.find((d) => getIdentificationKey(d.data) === id),
    ])
    .filter(([a, b]) => !isEqual(a, b));

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  pairs.forEach(([itemFromCollection, itemFromSQL]) => {
    if (itemFromCollection && !itemFromSQL) {
      differencesCount++;
      console.warn(
        `Object with id ${getIdentificationKey(
          itemFromCollection.data
        )} not found in SQL readmodel`
      );
    }
    if (!itemFromCollection && itemFromSQL) {
      differencesCount++;
      console.warn(
        `Object with id ${getIdentificationKey(
          itemFromSQL.data
        )} not found in collection`
      );
    }
    if (itemFromCollection && itemFromSQL) {
      const objectsDiff = diff(itemFromCollection, itemFromSQL, { sort: true });
      if (objectsDiff) {
        differencesCount++;
        console.warn(
          `Differences in object with id ${getIdentificationKey(
            itemFromCollection.data
          )}`
        );
        console.warn(JSON.stringify(objectsDiff, null, 2));
      }
    }
  });

  if (differencesCount > 0) {
    loggerInstance.error(
      `Differences count for ${schema}: ${differencesCount}`
    );
  } else {
    loggerInstance.info(`No differences found for ${schema}`);
  }
}

async function main(): Promise<void> {
  const eservices = await readModelService.getAllReadModelEServices();
  const eservicesPostgres = await readModelServiceSQL.getAllEServices();

  compare(eservices, eservicesPostgres, "eservices");

  // TODO
  // const attributes = await readModelService.getAllReadModelAttributes();
  // const attributesPostgres =
  //   await attributeReadModelServiceSQL.getAllAttributes();

  // compare(attributes, attributesPostgres, "attributes");
}

export function zipDataById<T extends { id: string } | { kid: string }>(
  dataA: Array<WithMetadata<T>>,
  dataB: Array<WithMetadata<T>>
): Array<[WithMetadata<T> | undefined, WithMetadata<T> | undefined]> {
  const allIds = new Set(
    [...dataA, ...dataB].map((d) => getIdentificationKey(d.data))
  );
  return Array.from(allIds).map((id) => [
    dataA.find((d) => getIdentificationKey(d.data) === id),
    dataB.find((d) => getIdentificationKey(d.data) === id),
  ]);
}

await main();
