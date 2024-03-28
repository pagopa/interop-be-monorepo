/**
 * This script is used to compare the data of the scala generated readmodel with the node generated readmodel.
 * The comparison is done by comparing the collection data from both the readmodels with a deep comparison, and if any differences are found,
 * the script will log the differences and exit with a non-zero exit code.
 */

import { z } from "zod";
import { ReadModelDbConfig, logger } from "pagopa-interop-commons";
import { MongoClient, Db } from "mongodb";
import isEqual from "lodash.isequal";

const Config = z
  .object({
    COLLECTION: z.enum(["agreements", "attributes", "eservices", "tenants"]),
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
    collection: c.COLLECTION,
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
    config.collection
  );

  if (differences.length > 0) {
    logger.warn("Differences found:");
    differences.forEach(([node, scala]) => {
      logger.warn("Node data:", node);
      logger.warn("Scala data:", scala);
    });
    process.exit(1);
  }

  logger.info("No differences found");
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

// Only run the script if it is the main module, not if it is imported
// This is useful for testing
if (require.main === module) {
  await main();
}
