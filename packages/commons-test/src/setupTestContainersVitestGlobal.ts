/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import { config as dotenv } from "dotenv-flow";
import { StartedTestContainer } from "testcontainers";
import {
  TEST_MINIO_PORT,
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  TestContainersConfig,
  minioContainer,
  mongoDBContainer,
  postgreSQLContainer,
} from "./containerTestUtils.js";
import type {} from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    config: TestContainersConfig;
  }
}

export function setupTestContainersVitestGlobal() {
  dotenv();
  const config = TestContainersConfig.parse(process.env);
  let teardown = false;

  return async function ({
    provide,
  }: {
    provide: (...args: unknown[]) => void;
  }): Promise<() => Promise<void>> {
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
      if (teardown) {
        throw new Error("teardown called twice");
      }

      teardown = true;
      await startedPostgreSqlContainer.stop();
      await startedMongodbContainer.stop();
      await startedMinioContainer?.stop();
    };
  };
}
