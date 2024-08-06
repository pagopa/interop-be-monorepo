/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */

import {
  DB,
  EmailManager,
  EventStoreConfig,
  FileManager,
  FileManagerConfig,
  LoggerConfig,
  ReadModelDbConfig,
  ReadModelRepository,
  S3Config,
  genericLogger,
  initDB,
  initEmailManager,
  initFileManager,
} from "pagopa-interop-commons";
import axios from "axios";
import { EmailManagerConfigTest } from "./testConfig.js";

/**
 * This function is a setup for vitest that initializes the read model repository, the postgres
 * database and the file manager and returns their instances along with a cleanup function.
 * The cleanup function deletes all the data from the read model repository and the event store
 * database and must be called at the end of each test (`afterEach`), to ensure that the tests are isolated.
 *
 * @param config The configuration object containing the connection parameters. It must be retrieved from the `config` object provided by the `setupTestContainersVitestGlobal` function with the vitest's `inject` function.
 *
 * @example
 * ```typescript
 * import { setupTestContainersVitest } from "pagopa-interop-commons-test";
 * import { inject, afterEach } from "vitest";
 *
 * export const { readModelRepository, postgresDB, fileManager, cleanup } =
 *   setupTestContainersVitest(inject("config"));
 *
 * afterEach(cleanup);
 * ```
 */
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig
): {
  readModelRepository: ReadModelRepository;
  cleanup: () => Promise<void>;
};
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig
): {
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  cleanup: () => Promise<void>;
};
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config & LoggerConfig
): {
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  cleanup: () => Promise<void>;
};
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config & LoggerConfig,
  emailManagerConfig?: EmailManagerConfigTest
): {
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  emailManager: EmailManager;
  cleanup: () => Promise<void>;
};
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config & LoggerConfig,
  emailManagerConfig?: EmailManagerConfigTest
): {
  readModelRepository?: ReadModelRepository;
  postgresDB?: DB;
  fileManager?: FileManager;
  emailManager?: EmailManager;
  cleanup: () => Promise<void>;
} {
  const s3OriginalBucket = fileManagerConfig?.s3Bucket;

  let readModelRepository: ReadModelRepository | undefined;
  let postgresDB: DB | undefined;
  let fileManager: FileManager | undefined;
  let emailManager: EmailManager | undefined;

  if (readModelDbConfig) {
    readModelRepository = ReadModelRepository.init(readModelDbConfig);
  }

  if (eventStoreConfig) {
    postgresDB = initDB({
      username: eventStoreConfig.eventStoreDbUsername,
      password: eventStoreConfig.eventStoreDbPassword,
      host: eventStoreConfig.eventStoreDbHost,
      port: eventStoreConfig.eventStoreDbPort,
      database: eventStoreConfig.eventStoreDbName,
      schema: eventStoreConfig.eventStoreDbSchema,
      useSSL: eventStoreConfig.eventStoreDbUseSSL,
    });
  }

  if (fileManagerConfig) {
    fileManager = initFileManager(fileManagerConfig);
  }

  if (emailManagerConfig) {
    emailManager = initEmailManager(emailManagerConfig, false);
  }

  return {
    readModelRepository,
    postgresDB,
    fileManager,
    emailManager,
    cleanup: async (): Promise<void> => {
      await readModelRepository?.agreements.deleteMany({});
      await readModelRepository?.eservices.deleteMany({});
      await readModelRepository?.tenants.deleteMany({});
      await readModelRepository?.purposes.deleteMany({});
      await readModelRepository?.attributes.deleteMany({});
      await readModelRepository?.clients.deleteMany({});
      await readModelRepository?.keys.deleteMany({});
      await readModelRepository?.producerKeychains.deleteMany({});

      await postgresDB?.none(
        "TRUNCATE TABLE agreement.events RESTART IDENTITY"
      );
      await postgresDB?.none(
        "TRUNCATE TABLE attribute.events RESTART IDENTITY"
      );
      await postgresDB?.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
      await postgresDB?.none("TRUNCATE TABLE tenant.events RESTART IDENTITY");
      await postgresDB?.none("TRUNCATE TABLE purpose.events RESTART IDENTITY");
      await postgresDB?.none(
        'TRUNCATE TABLE "authorization".events RESTART IDENTITY'
      );

      if (s3OriginalBucket && fileManagerConfig && fileManager) {
        const files = await fileManager.listFiles(
          s3OriginalBucket,
          genericLogger
        );
        await Promise.all(
          files.map(async (file) => {
            if (fileManager) {
              await fileManager.delete(s3OriginalBucket, file, genericLogger);
            }
          })
        );
        // Some tests change the bucket name, so we need to reset it
        fileManagerConfig.s3Bucket = s3OriginalBucket;
      }

      if (
        emailManagerConfig?.smtpAddress &&
        emailManagerConfig?.mailpitAPIPort
      ) {
        await axios.delete(
          `http://${emailManagerConfig?.smtpAddress}:${emailManagerConfig?.mailpitAPIPort}/api/v1/messages`
        );
      }
    },
  };
}
