/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */

import {
  DB,
  EventStoreConfig,
  FileManager,
  FileManagerConfig,
  RateLimiter,
  ReadModelDbConfig,
  ReadModelRepository,
  RedisRateLimiterConfig,
  S3Config,
  genericLogger,
  initDB,
  initPecEmailManager,
  initFileManager,
  initRedisRateLimiter,
  EmailManagerPEC,
  EmailManagerSES,
  AWSSesConfig,
  initSesMailManager,
  ReadModelSQLDbConfig,
  AnalyticsSQLDbConfig,
  InAppNotificationDBConfig,
  M2MEventSQLDbConfig,
  UserSQLDbConfig,
} from "pagopa-interop-commons";
import axios from "axios";
import { drizzle } from "drizzle-orm/node-postgres";
import { DrizzleReturnType } from "pagopa-interop-readmodel-models";
import pg from "pg";
import { PecEmailManagerConfigTest } from "./testConfig.js";

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
export async function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config,
  emailManagerConfig?: PecEmailManagerConfigTest
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  pecEmailManager: EmailManagerPEC;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config,
  emailManagerConfig?: PecEmailManagerConfigTest,
  RedisRateLimiterConfig?: RedisRateLimiterConfig,
  awsSESConfig?: AWSSesConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  pecEmailManager: EmailManagerPEC;
  sesEmailManager: EmailManagerSES;
  redisRateLimiter: RateLimiter;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config,
  emailManagerConfig?: PecEmailManagerConfigTest,
  RedisRateLimiterConfig?: RedisRateLimiterConfig,
  awsSESConfig?: AWSSesConfig,
  readModelSQLDbConfig?: ReadModelSQLDbConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  pecEmailManager: EmailManagerPEC;
  sesEmailManager: EmailManagerSES;
  redisRateLimiter: RateLimiter;
  readModelDB: DrizzleReturnType;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config,
  emailManagerConfig?: PecEmailManagerConfigTest,
  RedisRateLimiterConfig?: RedisRateLimiterConfig,
  awsSESConfig?: AWSSesConfig,
  readModelSQLDbConfig?: ReadModelSQLDbConfig,
  analyticsSQLDbConfig?: AnalyticsSQLDbConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  pecEmailManager: EmailManagerPEC;
  sesEmailManager: EmailManagerSES;
  redisRateLimiter: RateLimiter;
  readModelDB: DrizzleReturnType;
  analyticsPostgresDB: DB;
  cleanup: () => Promise<void>;
}>;
export async function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config,
  emailManagerConfig?: PecEmailManagerConfigTest,
  redisRateLimiterConfig?: RedisRateLimiterConfig,
  awsSESConfig?: AWSSesConfig,
  readModelSQLDbConfig?: ReadModelSQLDbConfig,
  analyticsSQLDbConfig?: AnalyticsSQLDbConfig,
  inAppNotificationDbConfig?: InAppNotificationDBConfig,
  userDbConfig?: UserSQLDbConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  pecEmailManager: EmailManagerPEC;
  sesEmailManager: EmailManagerSES;
  redisRateLimiter: RateLimiter;
  readModelDB: DrizzleReturnType;
  analyticsPostgresDB: DB;
  inAppNotificationDB: DrizzleReturnType;
  userDB: DrizzleReturnType;
  cleanup: () => Promise<void>;
}>;
export async function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config,
  emailManagerConfig?: PecEmailManagerConfigTest,
  redisRateLimiterConfig?: RedisRateLimiterConfig,
  awsSESConfig?: AWSSesConfig,
  readModelSQLDbConfig?: ReadModelSQLDbConfig,
  analyticsSQLDbConfig?: AnalyticsSQLDbConfig,
  inAppNotificationDbConfig?: InAppNotificationDBConfig,
  m2mEventDbConfig?: M2MEventSQLDbConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  pecEmailManager: EmailManagerPEC;
  sesEmailManager: EmailManagerSES;
  redisRateLimiter: RateLimiter;
  readModelDB: DrizzleReturnType;
  analyticsPostgresDB: DB;
  inAppNotificationDB: DrizzleReturnType;
  m2mEventDB: DrizzleReturnType;
  cleanup: () => Promise<void>;
}>;
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config,
  emailManagerConfig?: PecEmailManagerConfigTest,
  redisRateLimiterConfig?: RedisRateLimiterConfig,
  awsSESConfig?: AWSSesConfig,
  readModelSQLDbConfig?: ReadModelSQLDbConfig,
  analyticsSQLDbConfig?: AnalyticsSQLDbConfig,
  inAppNotificationDbConfig?: InAppNotificationDBConfig,
  userDbConfig?: UserSQLDbConfig
  m2mEventDbConfig?: M2MEventSQLDbConfig
): Promise<{
  readModelRepository?: ReadModelRepository;
  postgresDB?: DB;
  fileManager?: FileManager;
  pecEmailManager?: EmailManagerPEC;
  sesEmailManager?: EmailManagerSES;
  redisRateLimiter?: RateLimiter;
  readModelDB?: DrizzleReturnType;
  analyticsPostgresDB?: DB;
  inAppNotificationDB?: DrizzleReturnType;
  userDB?: DrizzleReturnType;
  m2mEventDB?: DrizzleReturnType;
  cleanup: () => Promise<void>;
}> {
  let readModelRepository: ReadModelRepository | undefined;
  let postgresDB: DB | undefined;
  let fileManager: FileManager | undefined;
  let pecEmailManager: EmailManagerPEC | undefined;
  let sesEmailManager: EmailManagerSES | undefined;
  let redisRateLimiter: RateLimiter | undefined;
  const redisRateLimiterGroup = "TEST";
  let readModelDB: DrizzleReturnType | undefined;
  let analyticsPostgresDB: DB | undefined;
  let inAppNotificationDB: DrizzleReturnType | undefined;
  let userDB: DrizzleReturnType | undefined;
  let m2mEventDB: DrizzleReturnType | undefined;
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
    fileManager = initFileManager({ ...fileManagerConfig, logLevel: "warn" });
  }

  if (emailManagerConfig) {
    pecEmailManager = initPecEmailManager(emailManagerConfig, false);
  }

  if (awsSESConfig) {
    sesEmailManager = initSesMailManager(awsSESConfig);
  }

  if (redisRateLimiterConfig) {
    redisRateLimiter = await initRedisRateLimiter({
      limiterGroup: redisRateLimiterGroup,
      maxRequests: redisRateLimiterConfig.rateLimiterMaxRequests,
      rateInterval: redisRateLimiterConfig.rateLimiterRateInterval,
      burstPercentage: redisRateLimiterConfig.rateLimiterBurstPercentage,
      redisHost: redisRateLimiterConfig.rateLimiterRedisHost,
      redisPort: redisRateLimiterConfig.rateLimiterRedisPort,
      timeout: redisRateLimiterConfig.rateLimiterTimeout,
    });
  }

  if (readModelSQLDbConfig) {
    const pool = new pg.Pool({
      host: readModelSQLDbConfig?.readModelSQLDbHost,
      port: readModelSQLDbConfig?.readModelSQLDbPort,
      database: readModelSQLDbConfig?.readModelSQLDbName,
      user: readModelSQLDbConfig?.readModelSQLDbUsername,
      password: readModelSQLDbConfig?.readModelSQLDbPassword,
      ssl: readModelSQLDbConfig?.readModelSQLDbUseSSL,
    });
    readModelDB = drizzle({ client: pool });
  }

  if (analyticsSQLDbConfig) {
    analyticsPostgresDB = initDB({
      username: analyticsSQLDbConfig.dbUsername,
      password: analyticsSQLDbConfig.dbPassword,
      host: analyticsSQLDbConfig.dbHost,
      port: analyticsSQLDbConfig.dbPort,
      database: analyticsSQLDbConfig.dbName,
      useSSL: analyticsSQLDbConfig.dbUseSSL,
      schema: analyticsSQLDbConfig.dbSchemaName,
    });
  }

  if (inAppNotificationDbConfig) {
    const pool = new pg.Pool({
      user: inAppNotificationDbConfig.inAppNotificationDBUsername,
      password: inAppNotificationDbConfig.inAppNotificationDBPassword,
      host: inAppNotificationDbConfig.inAppNotificationDBHost,
      port: inAppNotificationDbConfig.inAppNotificationDBPort,
      database: inAppNotificationDbConfig.inAppNotificationDBName,
      ssl: inAppNotificationDbConfig.inAppNotificationDBUseSSL,
    });
    inAppNotificationDB = drizzle({ client: pool });
  }

  if (userDbConfig) {
    const pool = new pg.Pool({
      user: userDbConfig.userSQLDbUsername,
      password: userDbConfig.userSQLDbPassword,
      host: userDbConfig.userSQLDbHost,
      port: userDbConfig.userSQLDbPort,
      database: userDbConfig.userSQLDbName,
      ssl: userDbConfig.userSQLDbUseSSL,
    });
    userDB = drizzle({ client: pool });
  if (m2mEventDbConfig) {
    const pool = new pg.Pool({
      user: m2mEventDbConfig.m2mEventSQLDbUsername,
      password: m2mEventDbConfig.m2mEventSQLDbPassword,
      host: m2mEventDbConfig.m2mEventSQLDbHost,
      port: m2mEventDbConfig.m2mEventSQLDbPort,
      database: m2mEventDbConfig.m2mEventSQLDbName,
      ssl: m2mEventDbConfig.m2mEventSQLDbUseSSL,
    });
    m2mEventDB = drizzle({ client: pool });
  }

  return {
    readModelRepository,
    postgresDB,
    fileManager,
    pecEmailManager,
    sesEmailManager,
    redisRateLimiter,
    readModelDB,
    analyticsPostgresDB,
    inAppNotificationDB,
    userDB,
    m2mEventDB,
    cleanup: async (): Promise<void> => {
      await readModelRepository?.agreements.deleteMany({});
      await readModelRepository?.eservices.deleteMany({});
      await readModelRepository?.tenants.deleteMany({});
      await readModelRepository?.purposes.deleteMany({});
      await readModelRepository?.attributes.deleteMany({});
      await readModelRepository?.clients.deleteMany({});
      await readModelRepository?.keys.deleteMany({});
      await readModelRepository?.producerKeychains.deleteMany({});
      await readModelRepository?.producerKeys.deleteMany({});
      await readModelRepository?.delegations.deleteMany({});
      await readModelRepository?.eserviceTemplates.deleteMany({});

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
      await postgresDB?.none(
        "TRUNCATE TABLE delegation.events RESTART IDENTITY"
      );
      await postgresDB?.none(
        "TRUNCATE TABLE eservice_template.events RESTART IDENTITY"
      );
      await postgresDB?.none(
        "TRUNCATE TABLE notification_config.events RESTART IDENTITY"
      );

      // CLEANUP READMODEL-SQL TABLES
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_agreement.agreement CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_attribute.attribute CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_catalog.eservice CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_client_jwk_key.client_jwk_key CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_client.client CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_delegation.delegation CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_producer_jwk_key.producer_jwk_key CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_producer_keychain.producer_keychain CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_purpose.purpose CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_purpose_template.purpose_template CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_tenant.tenant CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_eservice_template.eservice_template CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_notification_config.tenant_notification_config CASCADE"
      );
      await readModelDB?.execute(
        "TRUNCATE TABLE readmodel_notification_config.user_notification_config CASCADE"
      );

      // CLEANUP ANALYTICS-SQL TABLES
      await analyticsPostgresDB?.none(
        "TRUNCATE TABLE domains.agreement CASCADE"
      );
      await analyticsPostgresDB?.none(
        "TRUNCATE TABLE domains.attribute CASCADE"
      );
      await analyticsPostgresDB?.none(
        "TRUNCATE TABLE domains.eservice, domains.eservice_risk_analysis_answer, domains.eservice_risk_analysis CASCADE"
      );
      await analyticsPostgresDB?.none("TRUNCATE TABLE domains.client CASCADE");
      await analyticsPostgresDB?.none(
        "TRUNCATE TABLE domains.delegation CASCADE"
      );
      await analyticsPostgresDB?.none(
        "TRUNCATE TABLE domains.producer_keychain CASCADE"
      );
      await analyticsPostgresDB?.none("TRUNCATE TABLE domains.purpose CASCADE");
      await analyticsPostgresDB?.none("TRUNCATE TABLE domains.tenant CASCADE");
      await analyticsPostgresDB?.none(
        "TRUNCATE TABLE domains.eservice_template CASCADE"
      );

      // CLEANUP USER-SQL TABLES
      await userDB?.execute(`TRUNCATE TABLE "user"."user" CASCADE`);

      if (fileManagerConfig && fileManager) {
        const s3OriginalBucket =
          fileManagerConfig?.s3Bucket ?? "interop-local-bucket";

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

      if (awsSESConfig?.awsSesEndpoint) {
        await axios.post(`${awsSESConfig?.awsSesEndpoint}/clear-store`);
      }

      if (inAppNotificationDB) {
        await inAppNotificationDB.execute(
          "TRUNCATE TABLE notification.notification CASCADE"
        );
      }

      if (m2mEventDB) {
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.eservice_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.eservice_template_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.agreement_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.purpose_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.tenant_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.attribute_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.consumer_delegation_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.producer_delegation_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.client_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.producer_keychain_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.key_m2m_event CASCADE"
        );
        await m2mEventDB.execute(
          "TRUNCATE TABLE m2m_event.producer_key_m2m_event CASCADE"
        );
      }
    },
  };
}
