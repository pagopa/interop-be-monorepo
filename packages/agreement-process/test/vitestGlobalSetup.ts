/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import {
  postgreSQLContainer,
  mongoDBContainer,
  minioContainer,
  TEST_POSTGRES_DB_PORT,
  TEST_MONGO_DB_PORT,
  TEST_MINIO_PORT,
} from "pagopa-interop-commons-test";
import { config as dotenv } from "dotenv-flow";
import {
  EventStoreConfig,
  FileManagerConfig,
  ReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

dotenv();

const configSchema = ReadModelDbConfig.and(EventStoreConfig)
  .and(FileManagerConfig)
  .and(
    z
      .object({ S3_BUCKET: z.string() })
      .transform((c) => ({ s3Bucket: c.S3_BUCKET }))
  );
const config = configSchema.parse(process.env);

let teardown = false;

export default async function ({
  provide,
}: {
  provide: (...args: unknown[]) => void;
}): Promise<() => Promise<void>> {
  const startedPostgreSqlContainer = await postgreSQLContainer(config).start();
  const startedMongodbContainer = await mongoDBContainer(config).start();
  const startedMinioContainer = await minioContainer(config).start();

  config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
    TEST_POSTGRES_DB_PORT
  );
  config.readModelDbPort =
    startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
  config.s3ServerPort = startedMinioContainer.getMappedPort(TEST_MINIO_PORT);

  provide("config", config);

  return async (): Promise<void> => {
    if (teardown) {
      throw new Error("teardown called twice");
    }

    teardown = true;
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
    await startedMinioContainer.stop();
  };
}
