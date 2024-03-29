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
import { diffLines } from "diff";

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

  const differences = await getReadModelsCollectionDataDifferences(
    scalaReadModelDb,
    nodeReadModelDb,
    config.readModelCollection
  );

  if (differences.length > 0) {
    console.warn(`Differences found, red is scala, green is node:`);
    differences.forEach(([scala, node]) => {
      consoleStringDiffs(
        JSON.stringify(scala, null, 2),
        JSON.stringify(node, null, 2)
      );
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

export async function getReadModelsCollectionDataDifferences(
  readmodelA: Db,
  readmodelB: Db,
  collection: string
): Promise<Array<[Identifiable, Identifiable]>> {
  const resultsA = await readmodelA
    .collection(collection)
    .find()
    .map(({ data }) => Identifiable.parse(data))
    .toArray();

  const resultsB = await readmodelB
    .collection(collection)
    .find({ id: { $in: resultsA.map((d) => d.id) } })
    .map(({ data }) => Identifiable.parse(data))
    .toArray();

  return zipIdentifiableData(resultsA, resultsB).filter(
    ([a, b]) => !isEqual(a, b)
  );
}

export function zipIdentifiableData(
  dataA: Identifiable[],
  dataB: Identifiable[]
): Array<[Identifiable, Identifiable]> {
  return dataA.map((a) => {
    const b = dataB.find((d) => d.id === a.id);
    if (!b) {
      throw new Error(`Data A with id ${a.id} not found in data B`);
    }
    return [a, b];
  });
}

function consoleStringDiffs(a: string, b: string): void {
  const consoleFormatter = {
    added: (s: string) => `\x1b[32m${s}\x1b[0m`,
    removed: (s: string) => `\x1b[31m${s}\x1b[0m`,
    equal: (s: string) => s,
  } as const;

  diffLines(a, b).forEach((part) => {
    const color = part.added
      ? consoleFormatter.added
      : part.removed
      ? consoleFormatter.removed
      : consoleFormatter.equal;

    process.stderr.write(color(part.value));
  });
}

if (process.env.NODE_ENV !== "test") {
  await main();
}
