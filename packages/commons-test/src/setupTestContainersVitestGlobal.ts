/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import { config as dotenv } from "dotenv-flow";
import {
  AWSSesConfig,
  AnalyticsSQLDbConfig,
  DPoPConfig,
  EventStoreConfig,
  FileManagerConfig,
  ReadModelSQLDbConfig,
  RedisRateLimiterConfig,
  S3Config,
  TokenGenerationReadModelDbConfig,
  InAppNotificationDBConfig,
  M2MEventSQLDbConfig,
  DynamoDBClientConfig,
} from "pagopa-interop-commons";
import { StartedTestContainer } from "testcontainers";
import type {} from "vitest";
import type { GlobalSetupContext } from "vitest/node";
import {
  TEST_AWS_SES_PORT,
  TEST_DYNAMODB_PORT,
  TEST_MAILPIT_HTTP_PORT,
  TEST_MAILPIT_SMTP_PORT,
  TEST_MINIO_PORT,
  TEST_POSTGRES_DB_PORT,
  TEST_REDIS_PORT,
  awsSESContainer,
  dynamoDBContainer,
  mailpitContainer,
  minioContainer,
  postgreSQLReadModelContainer,
  postgreSQLContainer,
  redisContainer,
  postgreSQLAnalyticsContainer,
  inAppNotificationDBContainer,
  TEST_IN_APP_NOTIFICATION_DB_PORT,
  m2mEventDBContainer,
  TEST_M2M_EVENT_DB_PORT,
} from "./containerTestUtils.js";
import {
  EnhancedDPoPConfig,
  EnhancedTokenGenerationReadModelDbConfig,
  PecEmailManagerConfigTest,
  EnhancedDynamoDBClientConfig,
} from "./testConfig.js";

declare module "vitest" {
  export interface ProvidedContext {
    readModelSQLConfig?: ReadModelSQLDbConfig;
    tokenGenerationReadModelConfig?: EnhancedTokenGenerationReadModelDbConfig;
    eventStoreConfig?: EventStoreConfig;
    fileManagerConfig?: FileManagerConfig & S3Config;
    redisRateLimiterConfig?: RedisRateLimiterConfig;
    emailManagerConfig?: PecEmailManagerConfigTest;
    sesEmailManagerConfig?: AWSSesConfig;
    analyticsSQLConfig?: AnalyticsSQLDbConfig;
    dpopConfig?: EnhancedDPoPConfig;
    inAppNotificationDbConfig?: InAppNotificationDBConfig;
    m2mEventDbConfig?: M2MEventSQLDbConfig;
    dynamoDBClientConfig?: EnhancedDynamoDBClientConfig;
  }
}

/**
 * This function is a global setup for vitest that starts and stops test containers.
 * It must be called in a file that is used as a global setup in the vitest configuration.
 *
 * It provides the `config` object to the tests, via the `provide` function.
 *
 * @see https://vitest.dev/config/#globalsetup).
 */
export function setupTestContainersVitestGlobal() {
  dotenv();
  const eventStoreConfig = EventStoreConfig.safeParse(process.env);
  const readModelSQLConfig = ReadModelSQLDbConfig.safeParse(process.env);
  const analyticsSQLConfig = AnalyticsSQLDbConfig.safeParse(process.env);
  const fileManagerConfig = FileManagerConfig.safeParse(process.env);
  const redisRateLimiterConfig = RedisRateLimiterConfig.safeParse(process.env);
  const emailManagerConfig = PecEmailManagerConfigTest.safeParse(process.env);
  const awsSESConfig = AWSSesConfig.safeParse(process.env);
  const tokenGenerationReadModelConfig =
    TokenGenerationReadModelDbConfig.safeParse(process.env);
  const dpopConfig = DPoPConfig.safeParse(process.env);
  const inAppNotificationDbConfig = InAppNotificationDBConfig.safeParse(
    process.env
  );
  const dynamoDBClientConfig = DynamoDBClientConfig.safeParse(process.env);
  const m2mEventDbConfig = M2MEventSQLDbConfig.safeParse(process.env);

  return async function ({
    provide,
  }: GlobalSetupContext): Promise<() => Promise<void>> {
    let startedPostgreSqlContainer: StartedTestContainer | undefined;
    let startedPostgreSqlReadModelContainer: StartedTestContainer | undefined;
    let startedPostgreSqlAnalyticsContainer: StartedTestContainer | undefined;
    let startedMinioContainer: StartedTestContainer | undefined;
    let startedMailpitContainer: StartedTestContainer | undefined;
    let startedRedisContainer: StartedTestContainer | undefined;
    let startedDynamoDbContainer: StartedTestContainer | undefined;
    let startedAWSSesContainer: StartedTestContainer | undefined;
    let startedInAppNotificationContainer: StartedTestContainer | undefined;
    let startedM2MEventSQLDbContainer: StartedTestContainer | undefined;

    // Setting up the EventStore PostgreSQL container if the config is provided
    if (eventStoreConfig.success) {
      startedPostgreSqlContainer = await postgreSQLContainer(
        eventStoreConfig.data
      ).start();

      /**
       * Since testcontainers exposes to the host on a random port, in order to avoid port
       * collisions, we need to get the port through `getMappedPort` to connect to the databases.
       *
       * @see https://node.testcontainers.org/features/containers/#exposing-container-ports
       *
       * The comment applies to the other containers setup after this one as well.
       */
      eventStoreConfig.data.eventStoreDbPort =
        startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT);

      /**
       * Vitest global setup functions are executed in a separate process, vitest provides a way to
       * pass serializable data to the tests via the `provide` function.
       * In this case, we provide the `config` object to the tests, so that they can connect to the
       * started containers.
       *
       * The comment applies to the other containers setup after this one as well.
       */
      provide("eventStoreConfig", eventStoreConfig.data);
    }

    if (readModelSQLConfig.success) {
      startedPostgreSqlReadModelContainer = await postgreSQLReadModelContainer(
        readModelSQLConfig.data
      ).start();

      readModelSQLConfig.data.readModelSQLDbPort =
        startedPostgreSqlReadModelContainer.getMappedPort(
          TEST_POSTGRES_DB_PORT
        );

      provide("readModelSQLConfig", readModelSQLConfig.data);
    }

    if (analyticsSQLConfig.success) {
      startedPostgreSqlAnalyticsContainer = await postgreSQLAnalyticsContainer(
        analyticsSQLConfig.data
      ).start();
      analyticsSQLConfig.data.dbPort =
        startedPostgreSqlAnalyticsContainer.getMappedPort(
          TEST_POSTGRES_DB_PORT
        );

      provide("analyticsSQLConfig", analyticsSQLConfig.data);
    }

    // Setting up the Minio container if the config is provided
    if (fileManagerConfig.success) {
      const s3Bucket =
        S3Config.safeParse(process.env)?.data?.s3Bucket ??
        "interop-local-bucket";

      startedMinioContainer = await minioContainer({
        ...fileManagerConfig.data,
        s3Bucket,
      }).start();

      fileManagerConfig.data.s3ServerPort =
        startedMinioContainer?.getMappedPort(TEST_MINIO_PORT);

      provide("fileManagerConfig", {
        ...fileManagerConfig.data,
        s3Bucket,
      });
    }

    if (emailManagerConfig.success) {
      startedMailpitContainer = await mailpitContainer().start();
      emailManagerConfig.data.smtpPort = startedMailpitContainer.getMappedPort(
        TEST_MAILPIT_SMTP_PORT
      );
      emailManagerConfig.data.mailpitAPIPort =
        startedMailpitContainer.getMappedPort(TEST_MAILPIT_HTTP_PORT);
      emailManagerConfig.data.smtpAddress = startedMailpitContainer.getHost();
      provide("emailManagerConfig", emailManagerConfig.data);
    }

    // Setting up the DynamoDB container if the config is provided
    if (tokenGenerationReadModelConfig.success) {
      startedDynamoDbContainer = await dynamoDBContainer().start();

      provide("tokenGenerationReadModelConfig", {
        ...tokenGenerationReadModelConfig.data,
        tokenGenerationReadModelDbPort:
          startedDynamoDbContainer.getMappedPort(TEST_DYNAMODB_PORT),
      });
    }

    if (dpopConfig.success) {
      startedDynamoDbContainer = await dynamoDBContainer().start();

      provide("dpopConfig", {
        ...dpopConfig.data,
        dpopDbPort: startedDynamoDbContainer.getMappedPort(TEST_DYNAMODB_PORT),
      });
    }

    if (redisRateLimiterConfig.success) {
      startedRedisContainer = await redisContainer().start();
      redisRateLimiterConfig.data.rateLimiterRedisPort =
        startedRedisContainer.getMappedPort(TEST_REDIS_PORT);
      provide("redisRateLimiterConfig", redisRateLimiterConfig.data);
    }

    if (awsSESConfig.success) {
      startedAWSSesContainer = await awsSESContainer().start();
      provide("sesEmailManagerConfig", {
        awsRegion: awsSESConfig.data.awsRegion,
        awsSesEndpoint: `http://localhost:${startedAWSSesContainer.getMappedPort(
          TEST_AWS_SES_PORT
        )}`,
      });
    }

    if (inAppNotificationDbConfig.success) {
      startedInAppNotificationContainer = await inAppNotificationDBContainer(
        inAppNotificationDbConfig.data
      ).start();
      provide("inAppNotificationDbConfig", {
        ...inAppNotificationDbConfig.data,
        inAppNotificationDBPort:
          startedInAppNotificationContainer.getMappedPort(
            TEST_IN_APP_NOTIFICATION_DB_PORT
          ),
      });
    }

    if (dynamoDBClientConfig.success) {
      startedDynamoDbContainer = await dynamoDBContainer().start();

      provide("dynamoDBClientConfig", {
        ...dynamoDBClientConfig.data,
        dynamoDbTestPort:
          startedDynamoDbContainer.getMappedPort(TEST_DYNAMODB_PORT),
      });
    }

    if (m2mEventDbConfig.success) {
      startedInAppNotificationContainer = await m2mEventDBContainer(
        m2mEventDbConfig.data
      ).start();
      provide("m2mEventDbConfig", {
        ...m2mEventDbConfig.data,
        m2mEventSQLDbPort: startedInAppNotificationContainer.getMappedPort(
          TEST_M2M_EVENT_DB_PORT
        ),
      });
    }

    return async (): Promise<void> => {
      await startedPostgreSqlContainer?.stop();
      await startedPostgreSqlReadModelContainer?.stop();
      await startedPostgreSqlAnalyticsContainer?.stop();
      await startedMinioContainer?.stop();
      await startedMailpitContainer?.stop();
      await startedDynamoDbContainer?.stop();
      await startedRedisContainer?.stop();
      await startedAWSSesContainer?.stop();
      await startedInAppNotificationContainer?.stop();
      await startedM2MEventSQLDbContainer?.stop();
    };
  };
}
