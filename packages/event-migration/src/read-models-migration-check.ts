/* eslint-disable no-console */
/**
 * This script is used to compare the data of the scala generated readmodel with the node generated readmodel.
 * The comparison is done by comparing the collection data from both the readmodels with a deep comparison, and if any differences are found,
 * the script will log the differences and exit with a non-zero exit code.
 */

import { z } from "zod";
import { ReadModelDbConfig } from "pagopa-interop-commons";
import { MongoClient, Db } from "mongodb";
import isEqual from "lodash.isequal";
import { diff } from "json-diff";
import {
  Agreement,
  Attribute,
  Client,
  EService,
  ClientJWKKey,
  Purpose,
  Tenant,
} from "pagopa-interop-models";

const Collection = z.enum([
  "agreements",
  "attributes",
  "eservices",
  "tenants",
  "purposes",
  "clients",
  "keys",
]);
type Collection = z.infer<typeof Collection>;

const readModelSchemas = {
  agreements: Agreement,
  attributes: Attribute,
  eservices: EService,
  tenants: Tenant,
  purposes: Purpose,
  clients: Client,
  keys: ClientJWKKey,
} as const satisfies Record<Collection, z.ZodSchema<unknown>>;

const Config = z
  .object({
    NODE_COLLECTION_NAME: Collection,
    SCALA_COLLECTION_NAME: z.string(),
    SCALA_READMODEL_DB_HOST: z.string(),
    SCALA_READMODEL_DB_NAME: z.string(),
    SCALA_READMODEL_DB_USERNAME: z.string(),
    SCALA_READMODEL_DB_PASSWORD: z.string(),
    SCALA_READMODEL_DB_PORT: z.coerce.number().min(1001),
    NODE_READMODEL_DB_HOST: z.string(),
    NODE_READMODEL_DB_NAME: z.string(),
    NODE_READMODEL_DB_USERNAME: z.string(),
    NODE_READMODEL_DB_PASSWORD: z.string(),
    NODE_READMODEL_DB_PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    nodeCollectionName: c.NODE_COLLECTION_NAME,
    scalaCollectionName: c.SCALA_COLLECTION_NAME,
    scalaReadModelConfig: {
      readModelDbHost: c.SCALA_READMODEL_DB_HOST,
      readModelDbName: c.SCALA_READMODEL_DB_NAME,
      readModelDbUsername: c.SCALA_READMODEL_DB_USERNAME,
      readModelDbPassword: c.SCALA_READMODEL_DB_PASSWORD,
      readModelDbPort: c.SCALA_READMODEL_DB_PORT,
    },
    nodeReadModelConfig: {
      readModelDbHost: c.NODE_READMODEL_DB_HOST,
      readModelDbName: c.NODE_READMODEL_DB_NAME,
      readModelDbUsername: c.NODE_READMODEL_DB_USERNAME,
      readModelDbPassword: c.NODE_READMODEL_DB_PASSWORD,
      readModelDbPort: c.NODE_READMODEL_DB_PORT,
    },
  }));

type Config = z.infer<typeof Config>;

const config: Config = Config.parse(process.env);

function getIdentificationKey<T extends { id: string } | { kid: string }>(
  obj: T
): string {
  return "id" in obj ? obj.id : obj.kid;
}

async function main(): Promise<void> {
  const scalaReadModel = connectToReadModel(config.scalaReadModelConfig);
  const nodeReadModel = connectToReadModel(config.nodeReadModelConfig);

  const differences = await compareReadModelsCollection({
    readmodelA: scalaReadModel.db(config.scalaReadModelConfig.readModelDbName),
    readmodelB: nodeReadModel.db(config.nodeReadModelConfig.readModelDbName),
    collectionNameA: config.scalaCollectionName,
    collectionNameB: config.nodeCollectionName,
    schema: readModelSchemas[config.nodeCollectionName],
  });

  await scalaReadModel.close();
  await nodeReadModel.close();

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([scala, node]) => {
    if (scala && !node) {
      differencesCount++;
      console.warn(
        `Object with id ${getIdentificationKey(
          scala
        )} not found in node readmodel`
      );
    }
    if (!scala && node) {
      differencesCount++;
      console.warn(
        `Object with id ${getIdentificationKey(
          node
        )} not found in scala readmodel`
      );
    }
    if (scala && node) {
      const objectsDiff = diff(scala, node, { sort: true });
      if (objectsDiff) {
        differencesCount++;
        console.warn(
          `Differences in object with id ${getIdentificationKey(scala)}`
        );
        console.warn(JSON.stringify(objectsDiff, null, 2));
      }
    }
  });

  if (differencesCount > 0) {
    process.exit(1);
  }

  console.log("No differences found");
}

function connectToReadModel({
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbUsername: username,
  readModelDbPassword: password,
}: ReadModelDbConfig): MongoClient {
  const mongoDBConnectionURI = `mongodb://${username}:${password}@${host}:${port}`;
  return new MongoClient(mongoDBConnectionURI, {
    retryWrites: false,
  });
}

export async function compareReadModelsCollection<
  TSchema extends z.ZodSchema<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  TCollectionData extends z.infer<TSchema>
>({
  readmodelA,
  readmodelB,
  collectionNameA,
  collectionNameB,
  schema,
}: {
  readmodelA: Db;
  readmodelB: Db;
  collectionNameA: string;
  collectionNameB: string;
  schema: TSchema;
}): Promise<Array<[TCollectionData | undefined, TCollectionData | undefined]>> {
  const [resultsA, resultsB] = await Promise.all([
    readmodelA
      .collection(collectionNameA)
      .find()
      .map(({ data }) => {
        if (
          collectionNameA.includes("clients") &&
          data.purposes !== undefined
        ) {
          const adjusted = {
            ...data,
            purposes: data.purposes.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (stateUpdate: any) => stateUpdate.purpose.purposeId
            ),
          };
          return schema.parse(adjusted);
        } else {
          return schema.parse(data);
        }
      })
      .toArray(),
    readmodelB
      .collection(collectionNameB)
      .find()
      .map(({ data }) => schema.parse(data))
      .toArray(),
  ]);

  return zipDataById(resultsA, resultsB).filter(([a, b]) => !isEqual(a, b));
}

export function zipDataById<T extends { id: string } | { kid: string }>(
  dataA: T[],
  dataB: T[]
): Array<[T | undefined, T | undefined]> {
  const allIds = new Set(
    [...dataA, ...dataB].map((d) => getIdentificationKey(d))
  );
  return Array.from(allIds).map((id) => [
    dataA.find((d) => getIdentificationKey(d) === id),
    dataB.find((d) => getIdentificationKey(d) === id),
  ]);
}

if (process.env.NODE_ENV !== "test") {
  await main();
}
