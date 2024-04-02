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
import {
  diff,
  // addedDiff,
  // deletedDiff,
  // updatedDiff,
  // detailedDiff,
} from "deep-object-diff";

const Config = z
  .object({
    READ_MODEL_COLLECTION: z.enum([
      "agreements",
      "attributes",
      "eservices",
      "tenants",
    ]),
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
    readModelCollection: c.READ_MODEL_COLLECTION,
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

const config: Config = {
  ...Config.parse(process.env),
};

const Identifiable = z
  .object({
    id: z.string(),
  })
  .passthrough();
type Identifiable = z.infer<typeof Identifiable>;

async function main(): Promise<void> {
  const scalaReadModelDb = connectToReadModelDb(config.scalaReadModelConfig);
  const nodeReadModelDb = connectToReadModelDb(config.nodeReadModelConfig);

  const differences = await compareReadModelsCollection(
    scalaReadModelDb,
    nodeReadModelDb,
    config.readModelCollection
  );

  if (differences.length > 0) {
    console.warn(
      `Differences found in ${config.readModelCollection} collection`
    );
    differences.forEach(([scala, node]) => {
      if (scala && !node) {
        console.warn(`Object with id ${scala.id} not found in node readmodel`);
      }
      if (!scala && node) {
        console.warn(`Object with id ${node.id} not found in scala readmodel`);
      }
      if (scala && node) {
        console.warn(`Differences in object with id ${scala.id}`);
        diff(scala, node);
      }
    });
    process.exit(1);
  }

  console.log("No differences found");
}

function connectToReadModelDb({
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbUsername: username,
  readModelDbPassword: password,
  readModelDbName: database,
}: ReadModelDbConfig): Db {
  const mongoDBConnectionURI = `mongodb://${username}:${password}@${host}:${port}`;
  const client = new MongoClient(mongoDBConnectionURI, {
    retryWrites: false,
  });
  return client.db(database);
}

export async function compareReadModelsCollection(
  readmodelA: Db,
  readmodelB: Db,
  collection: string
): Promise<Array<[Identifiable | undefined, Identifiable | undefined]>> {
  const resultsA = await readmodelA
    .collection(collection)
    .find()
    .map(({ data }) => Identifiable.parse(data))
    .toArray();

  const resultsB = await readmodelB
    .collection(collection)
    .find()
    .map(({ data }) => Identifiable.parse(data))
    .toArray();

  return zipIdentifiableData(resultsA, resultsB).filter(
    ([a, b]) => !isEqual(a, b)
  );
}

export function zipIdentifiableData(
  dataA: Identifiable[],
  dataB: Identifiable[]
): Array<[Identifiable | undefined, Identifiable | undefined]> {
  const allIds = new Set([...dataA, ...dataB].map((d) => d.id));
  return Array.from(allIds).map((id) => [
    dataA.find((d) => d.id === id),
    dataB.find((d) => d.id === id),
  ]);
}

if (process.env.NODE_ENV !== "test") {
  await main();
}
