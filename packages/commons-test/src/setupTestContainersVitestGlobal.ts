/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable no-console */
// /* eslint-disable @typescript-eslint/ban-ts-comment */
// /* eslint-disable @typescript-eslint/explicit-function-return-type */
// /* eslint-disable functional/immutable-data */
// /* eslint-disable functional/no-let */

// import { config as dotenv } from "dotenv-flow";
// import {
//   AWSSesConfig,
//   AnalyticsSQLDbConfig,
//   EventStoreConfig,
//   FileManagerConfig,
//   ReadModelDbConfig,
//   ReadModelSQLDbConfig,
//   RedisRateLimiterConfig,
//   S3Config,
//   TokenGenerationReadModelDbConfig,
// } from "pagopa-interop-commons";
// import { StartedTestContainer } from "testcontainers";
// import type {} from "vitest";
// import type { GlobalSetupContext } from "vitest/node";
// import { z } from "zod";
// import {
//   TEST_AWS_SES_PORT,
//   TEST_DYNAMODB_PORT,
//   TEST_MAILPIT_HTTP_PORT,
//   TEST_MAILPIT_SMTP_PORT,
//   TEST_MINIO_PORT,
//   TEST_MONGO_DB_PORT,
//   TEST_POSTGRES_DB_PORT,
//   TEST_REDIS_PORT,
//   awsSESContainer,
//   dynamoDBContainer,
//   mailpitContainer,
//   minioContainer,
//   mongoDBContainer,
//   postgreSQLReadModelContainer,
//   postgreSQLContainer,
//   redisContainer,
//   postgreSQLAnalyticsContainer,
// } from "./containerTestUtils.js";
// import { PecEmailManagerConfigTest } from "./testConfig.js";

// const EnhancedTokenGenerationReadModelDbConfig =
//   TokenGenerationReadModelDbConfig.and(
//     z.object({ tokenGenerationReadModelDbPort: z.number() })
//   );
// type EnhancedTokenGenerationReadModelDbConfig = z.infer<
//   typeof EnhancedTokenGenerationReadModelDbConfig
// >;

// declare module "vitest" {
//   export interface ProvidedContext {
//     readModelConfig?: ReadModelDbConfig;
//     readModelSQLConfig?: ReadModelSQLDbConfig;
//     tokenGenerationReadModelConfig?: EnhancedTokenGenerationReadModelDbConfig;
//     eventStoreConfig?: EventStoreConfig;
//     fileManagerConfig?: FileManagerConfig & S3Config;
//     redisRateLimiterConfig?: RedisRateLimiterConfig;
//     emailManagerConfig?: PecEmailManagerConfigTest;
//     sesEmailManagerConfig?: AWSSesConfig;
//     analyticsSQLDbConfig?: AnalyticsSQLDbConfig;
//   }
// }

// /**
//  * This function is a global setup for vitest that starts and stops test containers for PostgreSQL, MongoDB and Minio.
//  * It must be called in a file that is used as a global setup in the vitest configuration.
//  *
//  * It provides the `config` object to the tests, via the `provide` function.
//  *
//  * @see https://vitest.dev/config/#globalsetup).
//  */
// export function setupTestContainersVitestGlobal() {
//   dotenv();
//   const eventStoreConfig = EventStoreConfig.safeParse(process.env);
//   const readModelConfig = ReadModelDbConfig.safeParse(process.env);
//   const readModelSQLConfig = ReadModelSQLDbConfig.safeParse(process.env);
//   const analyticsSQLDbConfig = AnalyticsSQLDbConfig.safeParse(process.env);
//   const fileManagerConfig = FileManagerConfig.safeParse(process.env);
//   const redisRateLimiterConfig = RedisRateLimiterConfig.safeParse(process.env);
//   const emailManagerConfig = PecEmailManagerConfigTest.safeParse(process.env);
//   const awsSESConfig = AWSSesConfig.safeParse(process.env);
//   const tokenGenerationReadModelConfig =
//     TokenGenerationReadModelDbConfig.safeParse(process.env);

//   return async function ({
//     provide,
//   }: GlobalSetupContext): Promise<() => Promise<void>> {
//     let startedPostgreSqlContainer: StartedTestContainer | undefined;
//     let startedPostgreSqlReadModelContainer: StartedTestContainer | undefined;
//     let startedPostgreSqlAnalyticsContainer: StartedTestContainer | undefined;
//     let startedMongodbContainer: StartedTestContainer | undefined;
//     let startedMinioContainer: StartedTestContainer | undefined;
//     let startedMailpitContainer: StartedTestContainer | undefined;
//     let startedRedisContainer: StartedTestContainer | undefined;
//     let startedDynamoDbContainer: StartedTestContainer | undefined;
//     let startedAWSSesContainer: StartedTestContainer | undefined;

//     // Setting up the EventStore PostgreSQL container if the config is provided
//     if (eventStoreConfig.success) {
//       startedPostgreSqlContainer = await postgreSQLContainer(
//         eventStoreConfig.data
//       ).start();

//       /**
//        * Since testcontainers exposes to the host on a random port, in order to avoid port
//        * collisions, we need to get the port through `getMappedPort` to connect to the databases.
//        *
//        * @see https://node.testcontainers.org/features/containers/#exposing-container-ports
//        *
//        * The comment applies to the other containers setup after this one as well.
//        */
//       eventStoreConfig.data.eventStoreDbPort =
//         startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT);

//       /**
//        * Vitest global setup functions are executed in a separate process, vitest provides a way to
//        * pass serializable data to the tests via the `provide` function.
//        * In this case, we provide the `config` object to the tests, so that they can connect to the
//        * started containers.
//        *
//        * The comment applies to the other containers setup after this one as well.
//        */
//       provide("eventStoreConfig", eventStoreConfig.data);
//     }

//     if (readModelSQLConfig.success) {
//       startedPostgreSqlReadModelContainer = await postgreSQLReadModelContainer(
//         readModelSQLConfig.data
//       ).start();

//       readModelSQLConfig.data.readModelSQLDbPort =
//         startedPostgreSqlReadModelContainer.getMappedPort(
//           TEST_POSTGRES_DB_PORT
//         );

//       provide("readModelSQLConfig", readModelSQLConfig.data);
//     }

//     if (analyticsSQLDbConfig.success) {
//       startedPostgreSqlAnalyticsContainer = await postgreSQLAnalyticsContainer(
//         analyticsSQLDbConfig.data
//       ).start();
//       analyticsSQLDbConfig.data.dbPort =
//         startedPostgreSqlAnalyticsContainer.getMappedPort(
//           TEST_POSTGRES_DB_PORT
//         );

//       provide("analyticsSQLDbConfig", analyticsSQLDbConfig.data);
//     }

//     // Setting up the MongoDB container if the config is provided
//     if (readModelConfig.success) {
//       startedMongodbContainer = await mongoDBContainer(
//         readModelConfig.data
//       ).start();

//       readModelConfig.data.readModelDbPort =
//         startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);

//       provide("readModelConfig", readModelConfig.data);
//     }

//     // Setting up the Minio container if the config is provided
//     if (fileManagerConfig.success) {
//       const s3Bucket =
//         S3Config.safeParse(process.env)?.data?.s3Bucket ??
//         "interop-local-bucket";

//       startedMinioContainer = await minioContainer({
//         ...fileManagerConfig.data,
//         s3Bucket,
//       }).start();

//       fileManagerConfig.data.s3ServerPort =
//         startedMinioContainer?.getMappedPort(TEST_MINIO_PORT);

//       provide("fileManagerConfig", {
//         ...fileManagerConfig.data,
//         s3Bucket,
//       });
//     }

//     if (emailManagerConfig.success) {
//       startedMailpitContainer = await mailpitContainer().start();
//       emailManagerConfig.data.smtpPort = startedMailpitContainer.getMappedPort(
//         TEST_MAILPIT_SMTP_PORT
//       );
//       emailManagerConfig.data.mailpitAPIPort =
//         startedMailpitContainer.getMappedPort(TEST_MAILPIT_HTTP_PORT);
//       emailManagerConfig.data.smtpAddress = startedMailpitContainer.getHost();
//       provide("emailManagerConfig", emailManagerConfig.data);
//     }

//     // Setting up the DynamoDB container if the config is provided
//     if (tokenGenerationReadModelConfig.success) {
//       startedDynamoDbContainer = await dynamoDBContainer().start();

//       provide("tokenGenerationReadModelConfig", {
//         ...tokenGenerationReadModelConfig.data,
//         tokenGenerationReadModelDbPort:
//           startedDynamoDbContainer.getMappedPort(TEST_DYNAMODB_PORT),
//       });
//     }

//     if (redisRateLimiterConfig.success) {
//       startedRedisContainer = await redisContainer().start();
//       redisRateLimiterConfig.data.rateLimiterRedisPort =
//         startedRedisContainer.getMappedPort(TEST_REDIS_PORT);
//       provide("redisRateLimiterConfig", redisRateLimiterConfig.data);
//     }

//     if (awsSESConfig.success) {
//       startedAWSSesContainer = await awsSESContainer().start();
//       provide("sesEmailManagerConfig", {
//         awsRegion: awsSESConfig.data.awsRegion,
//         awsSesEndpoint: `http://localhost:${startedAWSSesContainer.getMappedPort(
//           TEST_AWS_SES_PORT
//         )}`,
//       });
//     }

//     return async (): Promise<void> => {
//       await startedPostgreSqlContainer?.stop();
//       await startedPostgreSqlReadModelContainer?.stop();
//       await startedPostgreSqlAnalyticsContainer?.stop();
//       await startedMongodbContainer?.stop();
//       await startedMinioContainer?.stop();
//       await startedMailpitContainer?.stop();
//       await startedDynamoDbContainer?.stop();
//       await startedRedisContainer?.stop();
//       await startedAWSSesContainer?.stop();
//     };
//   };
// }

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import { config as dotenv } from "dotenv-flow";
import {
  AWSSesConfig,
  AnalyticsSQLDbConfig,
  EventStoreConfig,
  FileManagerConfig,
  ReadModelDbConfig,
  ReadModelSQLDbConfig,
  RedisRateLimiterConfig,
  S3Config,
  TokenGenerationReadModelDbConfig,
} from "pagopa-interop-commons";
import { Network, StartedNetwork, StartedTestContainer } from "testcontainers";
import { Client as PgClient } from "pg";
import { MongoClient } from "mongodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Redis } from "ioredis";
import type {} from "vitest";
import type { TestProject } from "vitest/node";
import { z } from "zod";
import {
  TEST_AWS_SES_PORT,
  TEST_DYNAMODB_PORT,
  TEST_MAILPIT_HTTP_PORT,
  TEST_MAILPIT_SMTP_PORT,
  TEST_MINIO_PORT,
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  TEST_REDIS_PORT,
  awsSESContainer,
  dynamoDBContainer,
  mailpitContainer,
  minioContainer,
  mongoDBContainer,
  postgreSQLReadModelContainer,
  postgreSQLContainer,
  redisContainer,
  postgreSQLAnalyticsContainer,
} from "./containerTestUtils.js";
import { PecEmailManagerConfigTest } from "./testConfig.js";

// Estendi il tipo per includere tokenGenerationReadModelDbHost
const EnhancedTokenGenerationReadModelDbConfig =
  TokenGenerationReadModelDbConfig.and(
    z.object({
      tokenGenerationReadModelDbPort: z.number(),
      tokenGenerationReadModelDbHost: z.string().optional(),
    })
  );
type EnhancedTokenGenerationReadModelDbConfig = z.infer<
  typeof EnhancedTokenGenerationReadModelDbConfig
>;

declare module "vitest" {
  export interface ProvidedContext {
    readModelConfig?: ReadModelDbConfig;
    readModelSQLConfig?: ReadModelSQLDbConfig;
    tokenGenerationReadModelConfig?: EnhancedTokenGenerationReadModelDbConfig;
    eventStoreConfig?: EventStoreConfig;
    fileManagerConfig?: FileManagerConfig & S3Config;
    redisRateLimiterConfig?: RedisRateLimiterConfig;
    emailManagerConfig?: PecEmailManagerConfigTest;
    sesEmailManagerConfig?: AWSSesConfig;
    analyticsSQLDbConfig?: AnalyticsSQLDbConfig;
    postgresEventStoreClient?: PgClient;
    postgresReadModelClient?: PgClient;
    postgresAnalyticsClient?: PgClient;
    mongoClient?: MongoClient;
    dynamoClient?: DynamoDBClient;
    redisClient?: Redis;
  }
}

/**
 * This function is a global setup for vitest that starts and stops test containers for PostgreSQL, MongoDB, MinIO, Redis, DynamoDB, Mailpit, and AWS SES.
 * It provides preconfigured clients and configs to the tests via the `provide` function.
 *
 * @see https://vitest.dev/config/#globalsetup
 */
export function setupTestContainersVitestGlobal() {
  dotenv();
  const eventStoreConfig = EventStoreConfig.safeParse(process.env);
  const readModelConfig = ReadModelDbConfig.safeParse(process.env);
  const readModelSQLConfig = ReadModelSQLDbConfig.safeParse(process.env);
  const analyticsSQLDbConfig = AnalyticsSQLDbConfig.safeParse(process.env);
  const fileManagerConfig = FileManagerConfig.safeParse(process.env);
  const redisRateLimiterConfig = RedisRateLimiterConfig.safeParse(process.env);
  const emailManagerConfig = PecEmailManagerConfigTest.safeParse(process.env);
  const awsSESConfig = AWSSesConfig.safeParse(process.env);
  const tokenGenerationReadModelConfig =
    TokenGenerationReadModelDbConfig.safeParse(process.env);

  return async function ({
    provide,
  }: TestProject): Promise<() => Promise<void>> {
    let startedPostgreSqlContainer: StartedTestContainer | undefined;
    let startedPostgreSqlReadModelContainer: StartedTestContainer | undefined;
    let startedPostgreSqlAnalyticsContainer: StartedTestContainer | undefined;
    let startedMongodbContainer: StartedTestContainer | undefined;
    let startedMinioContainer: StartedTestContainer | undefined;
    let startedMailpitContainer: StartedTestContainer | undefined;
    let startedRedisContainer: StartedTestContainer | undefined;
    let startedDynamoDbContainer: StartedTestContainer | undefined;
    let startedAWSSesContainer: StartedTestContainer | undefined;
    let network: StartedNetwork | undefined;
    let postgresEventStoreClient: PgClient | undefined;
    let postgresReadModelClient: PgClient | undefined;
    let postgresAnalyticsClient: PgClient | undefined;
    let mongoClient: MongoClient | undefined;
    let dynamoClient: DynamoDBClient | undefined;
    let redisClient: Redis | undefined;

    try {
      console.log("Creating Docker network...");
      network = await new Network().start();
      console.log("Network created:", network.getName());

      const packageGroup = process.env.PACKAGE_GROUP ?? "default-package";

      const dbNamePrefix = `testdb-${packageGroup}`;

      if (eventStoreConfig.success) {
        console.log("Event store config:", {
          username: eventStoreConfig.data.eventStoreDbUsername,
          password: eventStoreConfig.data.eventStoreDbPassword
            ? "[REDACTED]"
            : "undefined",
          dbName: `${dbNamePrefix}-eventstore`,
        });

        console.log("Starting PostgreSQL container for event store...");
        try {
          startedPostgreSqlContainer = await postgreSQLContainer({
            ...eventStoreConfig.data,
            eventStoreDbName: `${dbNamePrefix}-eventstore`,
            eventStoreDbUsername: "root", // Usa username dal .env
            eventStoreDbPassword:
              eventStoreConfig.data.eventStoreDbPassword || "root", // Usa password dal .env
          })
            .withNetwork(network)
            .withNetworkAliases("postgres-eventstore")
            .withEnvironment({
              POSTGRES_USER: "root",
              POSTGRES_PASSWORD:
                eventStoreConfig.data.eventStoreDbPassword || "root",
              POSTGRES_DB: `${dbNamePrefix}-eventstore`,
            })
            .withHealthCheck({
              test: ["CMD-SHELL", "pg_isready -U root"],
              interval: 1000,
              timeout: 5000,
              retries: 5,
              startPeriod: 5000,
            })
            .start();
          console.log(
            "PostgreSQL container started:",
            startedPostgreSqlContainer.getId(),
            "on port:",
            startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT),
            "with host: host.docker.internal",
            "in network:",
            network.getName(),
            "network aliases:",
            startedPostgreSqlContainer.getNetworkNames()
          );
        } catch (error) {
          console.error("Failed to start PostgreSQL container:", error);
          throw error;
        }

        eventStoreConfig.data.eventStoreDbPort =
          startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT);
        eventStoreConfig.data.eventStoreDbHost = "host.docker.internal"; // Usa host.docker.internal come nella vecchia implementazione
        eventStoreConfig.data.eventStoreDbName = `${dbNamePrefix}-eventstore`;
        eventStoreConfig.data.eventStoreDbUsername = "root";
        eventStoreConfig.data.eventStoreDbPassword =
          eventStoreConfig.data.eventStoreDbPassword || "root";

        try {
          postgresEventStoreClient = new PgClient({
            host: eventStoreConfig.data.eventStoreDbHost,
            port: eventStoreConfig.data.eventStoreDbPort,
            user: eventStoreConfig.data.eventStoreDbUsername,
            password: eventStoreConfig.data.eventStoreDbPassword,
            database: eventStoreConfig.data.eventStoreDbName,
          });
          console.log("Attempting to connect to PostgreSQL with config:", {
            host: eventStoreConfig.data.eventStoreDbHost,
            port: eventStoreConfig.data.eventStoreDbPort,
            user: eventStoreConfig.data.eventStoreDbUsername,
            password: eventStoreConfig.data.eventStoreDbPassword
              ? "[REDACTED]"
              : "undefined",
            database: eventStoreConfig.data.eventStoreDbName,
          });
          await postgresEventStoreClient.connect();
          console.log("Connected to PostgreSQL event store");
        } catch (error) {
          console.error("Error connecting to PostgreSQL:", error);
          console.log("Keeping container alive for debug...");
          await new Promise((resolve) => setTimeout(resolve, 30000));
          throw error;
        }

        provide("eventStoreConfig", eventStoreConfig.data);
        provide("postgresEventStoreClient", postgresEventStoreClient);
      }
      if (readModelSQLConfig.success) {
        startedPostgreSqlReadModelContainer =
          await postgreSQLReadModelContainer({
            ...readModelSQLConfig.data,
            readModelSQLDbName: `${dbNamePrefix}-readmodel`,
          })
            .withNetwork(network)
            .withNetworkAliases("postgres-readmodel")
            .withReuse()
            .start();

        readModelSQLConfig.data.readModelSQLDbPort =
          startedPostgreSqlReadModelContainer.getMappedPort(
            TEST_POSTGRES_DB_PORT
          );
        readModelSQLConfig.data.readModelSQLDbHost = "postgres-readmodel";
        readModelSQLConfig.data.readModelSQLDbName = `${dbNamePrefix}-readmodel`;

        // Create and provide PostgreSQL client
        postgresReadModelClient = new PgClient({
          host: readModelSQLConfig.data.readModelSQLDbHost,
          port: readModelSQLConfig.data.readModelSQLDbPort,
          user: readModelSQLConfig.data.readModelSQLDbUsername,
          password: readModelSQLConfig.data.readModelSQLDbPassword,
          database: readModelSQLConfig.data.readModelSQLDbName,
        });
        await postgresReadModelClient.connect();

        provide("readModelSQLConfig", readModelSQLConfig.data);
        provide("postgresReadModelClient", postgresReadModelClient);
      }

      if (analyticsSQLDbConfig.success) {
        startedPostgreSqlAnalyticsContainer =
          await postgreSQLAnalyticsContainer({
            ...analyticsSQLDbConfig.data,
            dbName: `${dbNamePrefix}-analytics`,
          })
            .withNetwork(network)
            .withNetworkAliases("postgres-analytics")
            .withReuse()
            .start();

        analyticsSQLDbConfig.data.dbPort =
          startedPostgreSqlAnalyticsContainer.getMappedPort(
            TEST_POSTGRES_DB_PORT
          );
        analyticsSQLDbConfig.data.dbHost = "postgres-analytics";
        analyticsSQLDbConfig.data.dbName = `${dbNamePrefix}-analytics`;

        // Create and provide PostgreSQL client
        postgresAnalyticsClient = new PgClient({
          host: analyticsSQLDbConfig.data.dbHost,
          port: analyticsSQLDbConfig.data.dbPort,
          user: analyticsSQLDbConfig.data.dbUsername,
          password: analyticsSQLDbConfig.data.dbPassword,
          database: analyticsSQLDbConfig.data.dbName,
        });
        await postgresAnalyticsClient.connect();

        provide("analyticsSQLDbConfig", analyticsSQLDbConfig.data);
        provide("postgresAnalyticsClient", postgresAnalyticsClient);
      }

      // Setting up the MongoDB container if the config is provided
      if (readModelConfig.success) {
        startedMongodbContainer = await mongoDBContainer(readModelConfig.data)
          .withNetwork(network)
          .withNetworkAliases("mongodb")
          .withReuse()
          .start();

        readModelConfig.data.readModelDbPort =
          startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
        readModelConfig.data.readModelDbHost = "mongodb";

        // Create and provide MongoDB client
        mongoClient = new MongoClient(
          `mongodb://${readModelConfig.data.readModelDbHost}:${readModelConfig.data.readModelDbPort}`
        );
        await mongoClient.connect();

        provide("readModelConfig", readModelConfig.data);
        provide("mongoClient", mongoClient);
      }

      // Setting up the MinIO container if the config is provided
      if (fileManagerConfig.success) {
        const s3Bucket =
          S3Config.safeParse(process.env)?.data?.s3Bucket ?? "udp-local-bucket";

        startedMinioContainer = await minioContainer({
          ...fileManagerConfig.data,
          s3Bucket,
        })
          .withNetwork(network)
          .withNetworkAliases("minio")
          .withReuse()
          .start();

        fileManagerConfig.data.s3ServerPort =
          startedMinioContainer.getMappedPort(TEST_MINIO_PORT);
        fileManagerConfig.data.s3ServerHost = "minio";

        provide("fileManagerConfig", {
          ...fileManagerConfig.data,
          s3Bucket,
        });
      }

      if (emailManagerConfig.success) {
        startedMailpitContainer = await mailpitContainer()
          .withNetwork(network)
          .withNetworkAliases("mailpit")
          .withReuse()
          .start();

        emailManagerConfig.data.smtpPort =
          startedMailpitContainer.getMappedPort(TEST_MAILPIT_SMTP_PORT);
        emailManagerConfig.data.mailpitAPIPort =
          startedMailpitContainer.getMappedPort(TEST_MAILPIT_HTTP_PORT);
        emailManagerConfig.data.smtpAddress = "mailpit";

        provide("emailManagerConfig", emailManagerConfig.data);
      }

      // Setting up the DynamoDB container if the config is provided
      if (tokenGenerationReadModelConfig.success) {
        startedDynamoDbContainer = await dynamoDBContainer()
          .withNetwork(network)
          .withNetworkAliases("dynamodb")
          .withReuse()
          .start();

        const dynamoPort =
          startedDynamoDbContainer.getMappedPort(TEST_DYNAMODB_PORT);
        const dynamoHost = "dynamodb";

        // Create and provide DynamoDB client
        dynamoClient = new DynamoDBClient({
          endpoint: `http://${dynamoHost}:${dynamoPort}`,
          region: "us-east-1", // Configura la regione appropriata
          credentials: {
            accessKeyId: "test",
            secretAccessKey: "test",
          },
        });

        provide("tokenGenerationReadModelConfig", {
          ...tokenGenerationReadModelConfig.data,
          tokenGenerationReadModelDbPort: dynamoPort,
          tokenGenerationReadModelDbHost: dynamoHost,
        });
        provide("dynamoClient", dynamoClient);
      }

      if (redisRateLimiterConfig.success) {
        startedRedisContainer = await redisContainer()
          .withNetwork(network)
          .withNetworkAliases("redis")
          .withReuse()
          .start();

        redisRateLimiterConfig.data.rateLimiterRedisPort =
          startedRedisContainer.getMappedPort(TEST_REDIS_PORT);
        redisRateLimiterConfig.data.rateLimiterRedisHost = "redis";

        // Create and provide Redis client
        redisClient = new Redis({
          host: redisRateLimiterConfig.data.rateLimiterRedisHost,
          port: redisRateLimiterConfig.data.rateLimiterRedisPort,
        });

        provide("redisRateLimiterConfig", redisRateLimiterConfig.data);
        provide("redisClient", redisClient);
      }

      if (awsSESConfig.success) {
        startedAWSSesContainer = await awsSESContainer()
          .withNetwork(network)
          .withNetworkAliases("aws-ses")
          .withReuse()
          .start();

        provide("sesEmailManagerConfig", {
          awsRegion: awsSESConfig.data.awsRegion,
          awsSesEndpoint: `http://aws-ses:${startedAWSSesContainer.getMappedPort(
            TEST_AWS_SES_PORT
          )}`,
        });
      }

      return async () => {
        console.log("Cleaning up containers and network...");
        await postgresEventStoreClient?.end();
        await postgresReadModelClient?.end();
        await postgresAnalyticsClient?.end();
        await mongoClient?.close();
        await redisClient?.quit();
        await startedPostgreSqlContainer?.stop();
        await startedPostgreSqlReadModelContainer?.stop();
        await startedPostgreSqlAnalyticsContainer?.stop();
        await startedMongodbContainer?.stop();
        await startedMinioContainer?.stop();
        await startedMailpitContainer?.stop();
        await startedDynamoDbContainer?.stop();
        await startedRedisContainer?.stop();
        await startedAWSSesContainer?.stop();
        await network?.stop();
      };
    } catch (error) {
      console.error("Error in global setup:", error);
      console.log("Keeping container alive for debug...");
      // await new Promise((resolve) => setTimeout(resolve, 90000));
      throw error;
    }
  };
}
