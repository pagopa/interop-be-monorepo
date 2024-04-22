/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */

import {
  ReadModelRepository,
  initDB,
  logger,
  initFileManager,
} from "pagopa-interop-commons";
import { TestContainersConfig } from "./containerTestUtils.js";

export function setupTestContainersVitest(config: TestContainersConfig) {
  const s3OriginalBucket = config.s3Bucket;

  const readModelRepository = ReadModelRepository.init(config);

  const postgresDB = initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  });

  if (!postgresDB) {
    logger.error("postgresDB is undefined!!");
  }

  const fileManager = initFileManager(config);

  return {
    readModelRepository,
    postgresDB,
    fileManager,
    cleanup: async (): Promise<void> => {
      await readModelRepository.agreements.deleteMany({});
      await readModelRepository.eservices.deleteMany({});
      await readModelRepository.tenants.deleteMany({});
      await readModelRepository.purposes.deleteMany({});
      await readModelRepository.attributes.deleteMany({});

      await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
      await postgresDB.none("TRUNCATE TABLE attribute.events RESTART IDENTITY");
      await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
      await postgresDB.none("TRUNCATE TABLE tenant.events RESTART IDENTITY");
      await postgresDB.none("TRUNCATE TABLE purpose.events RESTART IDENTITY");

      // Some tests change the bucket name, so we need to reset it
      config.s3Bucket = s3OriginalBucket;
    },
  };
}
