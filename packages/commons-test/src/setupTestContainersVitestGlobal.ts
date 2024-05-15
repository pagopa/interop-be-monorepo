/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import { config as dotenv } from "dotenv-flow";
import { StartedTestContainer } from "testcontainers";
import type { GlobalSetupContext } from "vitest/node";
import type {} from "vitest";
import {
  EventStoreConfig,
  FileManagerConfig,
  ReadModelDbConfig,
} from "pagopa-interop-commons";
import {
  S3Config,
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
    config: Partial<TestContainersConfig>;
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
  const dbConfig = EventStoreConfig.safeParse(process.env);
  const readModelConfig = ReadModelDbConfig.safeParse(process.env);
  const s3Config = S3Config.safeParse(process.env);
  const fileManagerConfig = FileManagerConfig.safeParse(process.env);

  return async function ({
    provide,
  }: GlobalSetupContext): Promise<() => Promise<void>> {
    let startedPostgreSqlContainer: StartedTestContainer | undefined;
    if (dbConfig.success) {
      startedPostgreSqlContainer = await postgreSQLContainer(
        dbConfig.data
      ).start();
    }

    let startedMongodbContainer: StartedTestContainer | undefined;
    if (readModelConfig.success) {
      startedMongodbContainer = await mongoDBContainer(
        readModelConfig.data
      ).start();
    }

    // Start Minio container if the S3 bucket is provided
    let startedMinioContainer: StartedTestContainer | undefined;

    if (s3Config.success && s3Config.data.s3Bucket) {
      startedMinioContainer = await minioContainer({
        s3Bucket: s3Config.data.s3Bucket,
      }).start();
    }

    const config = {
      ...(dbConfig.success ? dbConfig.data : {}),
      ...(readModelConfig.success ? readModelConfig.data : {}),
      ...(s3Config.success ? s3Config.data : {}),
      ...(fileManagerConfig.success ? fileManagerConfig.data : {}),
    };

    /**
     * Since testcontainers exposes to the host on a random port, in order to avoid port
     * collisions, we need to get the port through `getMappedPort` to connect to the databases.
     *
     * @see https://node.testcontainers.org/features/containers/#exposing-container-ports
     */
    config.eventStoreDbPort = startedPostgreSqlContainer?.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort =
      startedMongodbContainer?.getMappedPort(TEST_MONGO_DB_PORT);

    // @ts-ignore
    config.s3ServerPort = startedMinioContainer?.getMappedPort(TEST_MINIO_PORT);

    /**
     * Vitest global setup functions are executed in a separate process, vitest provides a way to
     * pass serializable data to the tests via the `provide` function.
     * In this case, we provide the `config` object to the tests, so that they can connect to the
     * started containers.
     */
    provide("config", config);

    return async (): Promise<void> => {
      await startedPostgreSqlContainer?.stop();
      await startedMongodbContainer?.stop();
      await startedMinioContainer?.stop();
    };
  };
}
