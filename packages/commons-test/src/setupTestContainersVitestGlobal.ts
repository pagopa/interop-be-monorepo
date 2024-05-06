/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import { config as dotenv } from "dotenv-flow";
import { StartedTestContainer } from "testcontainers";
import type { GlobalSetupContext } from "vitest/node";
import type {} from "vitest";
import {
  TEST_MINIO_PORT,
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  TestContainersConfig,
  minioContainer,
  mongoDBContainer,
  postgreSQLContainer,
} from "./containerTestUtils.js";

declare module "vitest" {
  export interface ProvidedContext {
    config: TestContainersConfig;
  }
}

/**
 * This function is a global setup for vitest that starts and stops test containers for PostgreSQL, MongoDB and Minio.
 * It must be called in a file that is used as a global setup in the vitest configuration.
 *
 * It provides the `config` object to the tests, via the `provide` function.
 *
 * @see https://vitest.dev/config/#globalsetup).
 */
export function setupTestContainersVitestGlobal() {
  dotenv();
  const config = TestContainersConfig.parse(process.env);

  return async function ({
    provide,
  }: GlobalSetupContext): Promise<() => Promise<void>> {
    const startedPostgreSqlContainer = await postgreSQLContainer(
      config
    ).start();
    const startedMongodbContainer = await mongoDBContainer(config).start();

    config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort =
      startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);

    let startedMinioContainer: StartedTestContainer | undefined;

    if (config.s3Bucket) {
      startedMinioContainer = await minioContainer({
        s3Bucket: config.s3Bucket,
      }).start();
      config.s3ServerPort =
        startedMinioContainer.getMappedPort(TEST_MINIO_PORT);
    }

    provide("config", config);

    return async (): Promise<void> => {
      await startedPostgreSqlContainer.stop();
      await startedMongodbContainer.stop();
      await startedMinioContainer?.stop();
    };
  };
}
