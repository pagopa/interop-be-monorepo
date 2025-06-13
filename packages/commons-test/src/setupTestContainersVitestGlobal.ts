/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable complexity */
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
// import { Network, StartedNetwork, StartedTestContainer } from "testcontainers";
// import { Client as PgClient } from "pg";
// import { MongoClient } from "mongodb";
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { Redis } from "ioredis";
// import type {} from "vitest";
// import type { TestProject } from "vitest/node";
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

// // Estendi il tipo per includere tokenGenerationReadModelDbHost
// const EnhancedTokenGenerationReadModelDbConfig =
//   TokenGenerationReadModelDbConfig.and(
//     z.object({
//       tokenGenerationReadModelDbPort: z.number(),
//       tokenGenerationReadModelDbHost: z.string().optional(),
//     })
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
//     postgresEventStoreClient?: PgClient;
//     postgresReadModelClient?: PgClient;
//     postgresAnalyticsClient?: PgClient;
//     mongoClient?: MongoClient;
//     dynamoClient?: DynamoDBClient;
//     redisClient?: Redis;
//   }
// }

// /**
//  * This function is a global setup for vitest that starts and stops test containers for PostgreSQL, MongoDB, MinIO, Redis, DynamoDB, Mailpit, and AWS SES.
//  * It provides preconfigured clients and configs to the tests via the `provide` function.
//  *
//  * @see https://vitest.dev/config/#globalsetup
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
//   }: TestProject): Promise<() => Promise<void>> {
//     let startedPostgreSqlContainer: StartedTestContainer | undefined;
//     let startedPostgreSqlReadModelContainer: StartedTestContainer | undefined;
//     let startedPostgreSqlAnalyticsContainer: StartedTestContainer | undefined;
//     let startedMongodbContainer: StartedTestContainer | undefined;
//     let startedMinioContainer: StartedTestContainer | undefined;
//     let startedMailpitContainer: StartedTestContainer | undefined;
//     let startedRedisContainer: StartedTestContainer | undefined;
//     let startedDynamoDbContainer: StartedTestContainer | undefined;
//     let startedAWSSesContainer: StartedTestContainer | undefined;
//     let network: StartedNetwork | undefined;
//     let postgresEventStoreClient: PgClient | undefined;
//     let postgresReadModelClient: PgClient | undefined;
//     let postgresAnalyticsClient: PgClient | undefined;
//     let mongoClient: MongoClient | undefined;
//     let dynamoClient: DynamoDBClient | undefined;
//     let redisClient: Redis | undefined;

//     try {
//       console.log("Creating Docker network...");
//       network = await new Network().start();
//       console.log("Network created:", network.getName());

//       const packageGroup = process.env.PACKAGE_GROUP ?? "default-package";

//       const dbNamePrefix = `testdb-${packageGroup}`;

//       if (eventStoreConfig.success) {
//         console.log("Event store config:", {
//           username: eventStoreConfig.data.eventStoreDbUsername,
//           password: eventStoreConfig.data.eventStoreDbPassword
//             ? "[REDACTED]"
//             : "undefined",
//           dbName: `${dbNamePrefix}-eventstore`,
//         });

//         console.log("Starting PostgreSQL container for event store...");
//         try {
//           startedPostgreSqlContainer = await postgreSQLContainer({
//             ...eventStoreConfig.data,
//             eventStoreDbName: `${dbNamePrefix}-eventstore`,
//             eventStoreDbUsername: "root", // Usa username dal .env
//             eventStoreDbPassword:
//               eventStoreConfig.data.eventStoreDbPassword || "root", // Usa password dal .env
//           })
//             .withNetwork(network)
//             .withNetworkAliases("postgres-eventstore")
//             .withEnvironment({
//               POSTGRES_USER: "root",
//               POSTGRES_PASSWORD:
//                 eventStoreConfig.data.eventStoreDbPassword || "root",
//               POSTGRES_DB: `${dbNamePrefix}-eventstore`,
//             })
//             .withHealthCheck({
//               test: ["CMD-SHELL", "pg_isready -U root"],
//               interval: 1000,
//               timeout: 5000,
//               retries: 5,
//               startPeriod: 5000,
//             })
//             .start();
//           console.log(
//             "PostgreSQL container started:",
//             startedPostgreSqlContainer.getId(),
//             "on port:",
//             startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT),
//             "with host: host.docker.internal",
//             "in network:",
//             network.getName(),
//             "network aliases:",
//             startedPostgreSqlContainer.getNetworkNames()
//           );
//         } catch (error) {
//           console.error("Failed to start PostgreSQL container:", error);
//           throw error;
//         }

//         eventStoreConfig.data.eventStoreDbPort =
//           startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT);
//         eventStoreConfig.data.eventStoreDbHost = "127.0.0.1";
//         eventStoreConfig.data.eventStoreDbName = `${dbNamePrefix}-eventstore`;
//         eventStoreConfig.data.eventStoreDbUsername = "root";
//         eventStoreConfig.data.eventStoreDbPassword =
//           eventStoreConfig.data.eventStoreDbPassword || "root";

//         try {
//           postgresEventStoreClient = new PgClient({
//             host: eventStoreConfig.data.eventStoreDbHost,
//             port: eventStoreConfig.data.eventStoreDbPort,
//             user: eventStoreConfig.data.eventStoreDbUsername,
//             password: eventStoreConfig.data.eventStoreDbPassword,
//             database: eventStoreConfig.data.eventStoreDbName,
//           });
//           console.log("Attempting to connect to PostgreSQL with config:", {
//             host: eventStoreConfig.data.eventStoreDbHost,
//             port: eventStoreConfig.data.eventStoreDbPort,
//             user: eventStoreConfig.data.eventStoreDbUsername,
//             password: eventStoreConfig.data.eventStoreDbPassword
//               ? "[REDACTED]"
//               : "undefined",
//             database: eventStoreConfig.data.eventStoreDbName,
//           });
//           await postgresEventStoreClient.connect();
//           console.log("Connected to PostgreSQL event store");
//         } catch (error) {
//           console.error("Error connecting to PostgreSQL:", error);
//           console.log("Keeping container alive for debug...");
//           await new Promise((resolve) => setTimeout(resolve, 30000));
//           throw error;
//         }

//         provide("eventStoreConfig", eventStoreConfig.data);
//         provide("postgresEventStoreClient", postgresEventStoreClient);
//       }
//       if (readModelSQLConfig.success) {
//         startedPostgreSqlReadModelContainer =
//           await postgreSQLReadModelContainer({
//             ...readModelSQLConfig.data,
//             readModelSQLDbName: `${dbNamePrefix}-readmodel`,
//           })
//             .withNetwork(network)
//             .withNetworkAliases("postgres-readmodel")
//             .withReuse()
//             .start();

//         readModelSQLConfig.data.readModelSQLDbPort =
//           startedPostgreSqlReadModelContainer.getMappedPort(
//             TEST_POSTGRES_DB_PORT
//           );
//         readModelSQLConfig.data.readModelSQLDbHost = "postgres-readmodel";
//         readModelSQLConfig.data.readModelSQLDbName = `${dbNamePrefix}-readmodel`;

//         // Create and provide PostgreSQL client
//         postgresReadModelClient = new PgClient({
//           host: readModelSQLConfig.data.readModelSQLDbHost,
//           port: readModelSQLConfig.data.readModelSQLDbPort,
//           user: readModelSQLConfig.data.readModelSQLDbUsername,
//           password: readModelSQLConfig.data.readModelSQLDbPassword,
//           database: readModelSQLConfig.data.readModelSQLDbName,
//         });
//         await postgresReadModelClient.connect();

//         provide("readModelSQLConfig", readModelSQLConfig.data);
//         provide("postgresReadModelClient", postgresReadModelClient);
//       }

//       if (analyticsSQLDbConfig.success) {
//         startedPostgreSqlAnalyticsContainer =
//           await postgreSQLAnalyticsContainer({
//             ...analyticsSQLDbConfig.data,
//             dbName: `${dbNamePrefix}-analytics`,
//           })
//             .withNetwork(network)
//             .withNetworkAliases("postgres-analytics")
//             .withReuse()
//             .start();

//         analyticsSQLDbConfig.data.dbPort =
//           startedPostgreSqlAnalyticsContainer.getMappedPort(
//             TEST_POSTGRES_DB_PORT
//           );
//         analyticsSQLDbConfig.data.dbHost = "postgres-analytics";
//         analyticsSQLDbConfig.data.dbName = `${dbNamePrefix}-analytics`;

//         // Create and provide PostgreSQL client
//         postgresAnalyticsClient = new PgClient({
//           host: analyticsSQLDbConfig.data.dbHost,
//           port: analyticsSQLDbConfig.data.dbPort,
//           user: analyticsSQLDbConfig.data.dbUsername,
//           password: analyticsSQLDbConfig.data.dbPassword,
//           database: analyticsSQLDbConfig.data.dbName,
//         });
//         await postgresAnalyticsClient.connect();

//         provide("analyticsSQLDbConfig", analyticsSQLDbConfig.data);
//         provide("postgresAnalyticsClient", postgresAnalyticsClient);
//       }

//       // Setting up the MongoDB container if the config is provided
//       if (readModelConfig.success) {
//         startedMongodbContainer = await mongoDBContainer(readModelConfig.data)
//           .withNetwork(network)
//           .withNetworkAliases("mongodb")
//           .withReuse()
//           .start();

//         readModelConfig.data.readModelDbPort =
//           startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
//         readModelConfig.data.readModelDbHost = "mongodb";

//         // Create and provide MongoDB client
//         mongoClient = new MongoClient(
//           `mongodb://${readModelConfig.data.readModelDbHost}:${readModelConfig.data.readModelDbPort}`
//         );
//         await mongoClient.connect();

//         provide("readModelConfig", readModelConfig.data);
//         provide("mongoClient", mongoClient);
//       }

//       // Setting up the MinIO container if the config is provided
//       if (fileManagerConfig.success) {
//         const s3Bucket =
//           S3Config.safeParse(process.env)?.data?.s3Bucket ?? "udp-local-bucket";

//         startedMinioContainer = await minioContainer({
//           ...fileManagerConfig.data,
//           s3Bucket,
//         })
//           .withNetwork(network)
//           .withNetworkAliases("minio")
//           .withReuse()
//           .start();

//         fileManagerConfig.data.s3ServerPort =
//           startedMinioContainer.getMappedPort(TEST_MINIO_PORT);
//         fileManagerConfig.data.s3ServerHost = "minio";

//         provide("fileManagerConfig", {
//           ...fileManagerConfig.data,
//           s3Bucket,
//         });
//       }

//       if (emailManagerConfig.success) {
//         startedMailpitContainer = await mailpitContainer()
//           .withNetwork(network)
//           .withNetworkAliases("mailpit")
//           .withReuse()
//           .start();

//         emailManagerConfig.data.smtpPort =
//           startedMailpitContainer.getMappedPort(TEST_MAILPIT_SMTP_PORT);
//         emailManagerConfig.data.mailpitAPIPort =
//           startedMailpitContainer.getMappedPort(TEST_MAILPIT_HTTP_PORT);
//         emailManagerConfig.data.smtpAddress = "mailpit";

//         provide("emailManagerConfig", emailManagerConfig.data);
//       }

//       // Setting up the DynamoDB container if the config is provided
//       if (tokenGenerationReadModelConfig.success) {
//         startedDynamoDbContainer = await dynamoDBContainer()
//           .withNetwork(network)
//           .withNetworkAliases("dynamodb")
//           .withReuse()
//           .start();

//         const dynamoPort =
//           startedDynamoDbContainer.getMappedPort(TEST_DYNAMODB_PORT);
//         const dynamoHost = "dynamodb";

//         // Create and provide DynamoDB client
//         dynamoClient = new DynamoDBClient({
//           endpoint: `http://${dynamoHost}:${dynamoPort}`,
//           region: "us-east-1", // Configura la regione appropriata
//           credentials: {
//             accessKeyId: "test",
//             secretAccessKey: "test",
//           },
//         });

//         provide("tokenGenerationReadModelConfig", {
//           ...tokenGenerationReadModelConfig.data,
//           tokenGenerationReadModelDbPort: dynamoPort,
//           tokenGenerationReadModelDbHost: dynamoHost,
//         });
//         provide("dynamoClient", dynamoClient);
//       }

//       if (redisRateLimiterConfig.success) {
//         startedRedisContainer = await redisContainer()
//           .withNetwork(network)
//           .withNetworkAliases("redis")
//           .withReuse()
//           .start();

//         redisRateLimiterConfig.data.rateLimiterRedisPort =
//           startedRedisContainer.getMappedPort(TEST_REDIS_PORT);
//         redisRateLimiterConfig.data.rateLimiterRedisHost = "redis";

//         // Create and provide Redis client
//         redisClient = new Redis({
//           host: redisRateLimiterConfig.data.rateLimiterRedisHost,
//           port: redisRateLimiterConfig.data.rateLimiterRedisPort,
//         });

//         provide("redisRateLimiterConfig", redisRateLimiterConfig.data);
//         provide("redisClient", redisClient);
//       }

//       if (awsSESConfig.success) {
//         startedAWSSesContainer = await awsSESContainer()
//           .withNetwork(network)
//           .withNetworkAliases("aws-ses")
//           .withReuse()
//           .start();

//         provide("sesEmailManagerConfig", {
//           awsRegion: awsSESConfig.data.awsRegion,
//           awsSesEndpoint: `http://aws-ses:${startedAWSSesContainer.getMappedPort(
//             TEST_AWS_SES_PORT
//           )}`,
//         });
//       }

//       return async () => {
//         console.log("Cleaning up containers and network...");
//         await postgresEventStoreClient?.end();
//         await postgresReadModelClient?.end();
//         await postgresAnalyticsClient?.end();
//         await mongoClient?.close();
//         await redisClient?.quit();
//         await startedPostgreSqlContainer?.stop();
//         await startedPostgreSqlReadModelContainer?.stop();
//         await startedPostgreSqlAnalyticsContainer?.stop();
//         await startedMongodbContainer?.stop();
//         await startedMinioContainer?.stop();
//         await startedMailpitContainer?.stop();
//         await startedDynamoDbContainer?.stop();
//         await startedRedisContainer?.stop();
//         await startedAWSSesContainer?.stop();
//         await network?.stop();
//       };
//     } catch (error) {
//       console.error("Error in global setup:", error);
//       console.log("Keeping container alive for debug...");
//       // await new Promise((resolve) => setTimeout(resolve, 90000));
//       throw error;
//     }
//   };
// }

// import { config as dotenv } from "dotenv-flow";
// import {
//   AWSSesConfig,
//   AnalyticsSQLDbConfig,
//   EventStoreConfig,
//   // Rimosse FileManagerConfig, S3Config da qui
//   ReadModelDbConfig,
//   ReadModelSQLDbConfig,
//   RedisRateLimiterConfig,
//   TokenGenerationReadModelDbConfig,
// } from "pagopa-interop-commons";
// import { Network, StartedNetwork, StartedTestContainer } from "testcontainers";
// import type { TestProject } from "vitest/node";
// import { z } from "zod";
// import {
//   FileManagerConfig as OriginalFileManagerConfig,
//   S3Config as OriginalS3Config,
// } from "pagopa-interop-commons/src/config"; // <--- AGGIUSTA QUESTO PERCORSO SE NECESSARIO
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

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

// import { config as dotenv } from "dotenv-flow";
// import {
//   AWSSesConfig,
//   AnalyticsSQLDbConfig,
//   EventStoreConfig,
//   FileManagerConfig as OriginalFileManagerConfig,
//   ReadModelDbConfig,
//   ReadModelSQLDbConfig,
//   RedisRateLimiterConfig,
//   S3Config as OriginalS3Config,
//   TokenGenerationReadModelDbConfig,
// } from "pagopa-interop-commons";
// import { Network, StartedNetwork, StartedTestContainer } from "testcontainers";
// import type {} from "vitest";
// import type { TestProject } from "vitest/node";
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

// // --- Definizioni di tipi estese e importazioni Zod ---

// // Importa le definizioni originali FileManagerConfig e S3Config dal tuo commons
// // Assicurati che questo percorso sia corretto per il tuo progetto

// // Estendi il tipo per includere credenziali S3 e l'endpoint completo
// const EnhancedFileManagerConfig = OriginalFileManagerConfig.and(
//   OriginalS3Config // Unisci le proprietà di S3Config direttamente qui
// ).and(
//   z.object({
//     s3ServerEndpoint: z.string().optional(), // Aggiungi l'endpoint completo calcolato
//     s3AccessKeyId: z.string().optional(), // Aggiungi le credenziali S3
//     s3SecretAccessKey: z.string().optional(), // Aggiungi le credenziali S3
//   })
// );
// type EnhancedFileManagerConfig = z.infer<typeof EnhancedFileManagerConfig>;

// // Estendi il tipo per includere tokenGenerationReadModelDbHost
// const EnhancedTokenGenerationReadModelDbConfig =
//   TokenGenerationReadModelDbConfig.and(
//     z.object({
//       tokenGenerationReadModelDbPort: z.number(),
//       tokenGenerationReadModelDbHost: z.string().optional(),
//     })
//   );
// type EnhancedTokenGenerationReadModelDbConfig = z.infer<
//   typeof EnhancedTokenGenerationReadModelDbConfig
// >;

// // --- Dichiarazioni di contesto Vitest ---

// declare module "vitest" {
//   export interface ProvidedContext {
//     readModelConfig?: ReadModelDbConfig;
//     readModelSQLConfig?: ReadModelSQLDbConfig;
//     tokenGenerationReadModelConfig?: EnhancedTokenGenerationReadModelDbConfig;
//     eventStoreConfig?: EventStoreConfig;
//     fileManagerConfig?: EnhancedFileManagerConfig; // Usa il tipo esteso qui
//     redisRateLimiterConfig?: RedisRateLimiterConfig;
//     emailManagerConfig?: PecEmailManagerConfigTest;
//     sesEmailManagerConfig?: AWSSesConfig;
//     analyticsSQLDbConfig?: AnalyticsSQLDbConfig;
//   }
// }

// // --- Funzione di setup globale ---

// /**
//  * Questa funzione è il setup globale per Vitest.
//  * Avvia e arresta i container di test (PostgreSQL, MongoDB, MinIO, Redis, DynamoDB, Mailpit, AWS SES).
//  * Fornisce le **configurazioni di connessione** (serializzabili) ai test tramite la funzione `provide`.
//  * La creazione e la gestione dei client di database (non serializzabili) avverrà nei singoli test
//  * o in un setup per i test come `setupTestContainersVitest.ts`.
//  *
//  * @see https://vitest.dev/config/#globalsetup
//  */
// export function setupTestContainersVitestGlobal() {
//   dotenv();

//   // Parsing di tutte le configurazioni iniziali
//   const eventStoreConfig = EventStoreConfig.safeParse(process.env);
//   const readModelConfig = ReadModelDbConfig.safeParse(process.env);
//   const readModelSQLConfig = ReadModelSQLDbConfig.safeParse(process.env);
//   const analyticsSQLDbConfig = AnalyticsSQLDbConfig.safeParse(process.env);
//   const fileManagerConfigResult = OriginalFileManagerConfig.safeParse(
//     process.env
//   ); // Parsing del FileManagerConfig originale
//   const s3ConfigResult = OriginalS3Config.safeParse(process.env); // Parsing del S3Config originale
//   const redisRateLimiterConfig = RedisRateLimiterConfig.safeParse(process.env);
//   const emailManagerConfig = PecEmailManagerConfigTest.safeParse(process.env);
//   const awsSESConfig = AWSSesConfig.safeParse(process.env);
//   const tokenGenerationReadModelConfig =
//     TokenGenerationReadModelDbConfig.safeParse(process.env);

//   return async function ({
//     provide,
//   }: TestProject): Promise<() => Promise<void>> {
//     let startedPostgreSqlContainer: StartedTestContainer | undefined;
//     let startedPostgreSqlReadModelContainer: StartedTestContainer | undefined;
//     let startedPostgreSqlAnalyticsContainer: StartedTestContainer | undefined;
//     let startedMongodbContainer: StartedTestContainer | undefined;
//     let startedMinioContainer: StartedTestContainer | undefined;
//     let startedMailpitContainer: StartedTestContainer | undefined;
//     let startedRedisContainer: StartedTestContainer | undefined;
//     let startedDynamoDbContainer: StartedTestContainer | undefined;
//     let startedAWSSesContainer: StartedTestContainer | undefined;
//     let network: StartedNetwork | undefined;

//     try {
//       console.log("Creating Docker network...");
//       network = await new Network().start();
//       console.log("Network created:", network.getName());

//       const packageGroup = process.env.PACKAGE_GROUP ?? "default-package";
//       const dbNamePrefix = `testdb-${packageGroup}`;

//       // --- SETUP CONTAINER EVENT STORE (PostgreSQL) ---
//       if (eventStoreConfig.success) {
//         console.log("Event store config:", {
//           username: eventStoreConfig.data.eventStoreDbUsername,
//           password: eventStoreConfig.data.eventStoreDbPassword
//             ? "[REDACTED]"
//             : "undefined",
//           dbName: `${dbNamePrefix}-eventstore`,
//         });

//         console.log("Starting PostgreSQL container for event store...");
//         try {
//           // Passa i parametri di configurazione che il container builder si aspetta
//           startedPostgreSqlContainer = await postgreSQLContainer({
//             ...eventStoreConfig.data,
//             eventStoreDbName: `${dbNamePrefix}-eventstore`,
//             eventStoreDbUsername: "root", // Usa username dal .env
//             eventStoreDbPassword:
//               eventStoreConfig.data.eventStoreDbPassword || "root", // Usa password dal .env
//           })
//             .withNetwork(network)
//             .withNetworkAliases("postgres-eventstore")
//             .withEnvironment({
//               POSTGRES_USER: "root",
//               POSTGRES_PASSWORD:
//                 eventStoreConfig.data.eventStoreDbPassword || "root",
//               POSTGRES_DB: `${dbNamePrefix}-eventstore`,
//             })
//             .withHealthCheck({
//               test: ["CMD-SHELL", "pg_isready -U root"],
//               interval: 1000,
//               timeout: 5000,
//               retries: 5,
//               startPeriod: 5000,
//             })
//             .start();
//           console.log(
//             "PostgreSQL container started:",
//             startedPostgreSqlContainer.getId(),
//             "on port:",
//             startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT),
//             "with host: 127.0.0.1",
//             "in network:",
//             network.getName(),
//             "network aliases:",
//             startedPostgreSqlContainer.getNetworkNames()
//           );
//         } catch (error) {
//           console.error("Failed to start PostgreSQL container:", error);
//           throw error;
//         }

//         // Fornisci la configurazione (serializzabile) ai test
//         eventStoreConfig.data.eventStoreDbPort =
//           startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT);
//         eventStoreConfig.data.eventStoreDbHost = "127.0.0.1"; // Per connessioni dal Mac (dove Vitest gira)
//         eventStoreConfig.data.eventStoreDbName = `${dbNamePrefix}-eventstore`;
//         eventStoreConfig.data.eventStoreDbUsername = "root";
//         eventStoreConfig.data.eventStoreDbPassword =
//           eventStoreConfig.data.eventStoreDbPassword || "root";

//         provide("eventStoreConfig", eventStoreConfig.data);
//       }

//       // --- SETUP CONTAINER READ MODEL SQL (PostgreSQL) ---
//       if (readModelSQLConfig.success) {
//         startedPostgreSqlReadModelContainer =
//           await postgreSQLReadModelContainer({
//             ...readModelSQLConfig.data,
//             readModelSQLDbName: `${dbNamePrefix}-readmodel`,
//           })
//             .withNetwork(network)
//             .withNetworkAliases("postgres-readmodel")
//             .withReuse()
//             .start();

//         readModelSQLConfig.data.readModelSQLDbPort =
//           startedPostgreSqlReadModelContainer.getMappedPort(
//             TEST_POSTGRES_DB_PORT
//           );
//         readModelSQLConfig.data.readModelSQLDbHost = "127.0.0.1";
//         readModelSQLConfig.data.readModelSQLDbName = `${dbNamePrefix}-readmodel`;

//         provide("readModelSQLConfig", readModelSQLConfig.data);
//       }

//       // --- SETUP CONTAINER ANALYTICS SQL (PostgreSQL) ---
//       if (analyticsSQLDbConfig.success) {
//         startedPostgreSqlAnalyticsContainer =
//           await postgreSQLAnalyticsContainer({
//             ...analyticsSQLDbConfig.data,
//             dbName: `${dbNamePrefix}-analytics`,
//           })
//             .withNetwork(network)
//             .withNetworkAliases("postgres-analytics")
//             .withReuse()
//             .start();

//         analyticsSQLDbConfig.data.dbPort =
//           startedPostgreSqlAnalyticsContainer.getMappedPort(
//             TEST_POSTGRES_DB_PORT
//           );
//         analyticsSQLDbConfig.data.dbHost = "127.0.0.1";
//         analyticsSQLDbConfig.data.dbName = `${dbNamePrefix}-analytics`;

//         provide("analyticsSQLDbConfig", analyticsSQLDbConfig.data);
//       }

//       // --- SETUP CONTAINER MONGODB ---
//       if (readModelConfig.success) {
//         startedMongodbContainer = await mongoDBContainer(readModelConfig.data)
//           .withNetwork(network)
//           .withNetworkAliases("mongodb")
//           .withReuse()
//           .start();

//         readModelConfig.data.readModelDbPort =
//           startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
//         readModelConfig.data.readModelDbHost = "127.0.0.1";

//         provide("readModelConfig", readModelConfig.data);
//       }

//       // --- SETUP CONTAINER MINIO (S3) ---
//       if (fileManagerConfigResult.success && s3ConfigResult.success) {
//         // Combina i dati parseati delle configurazioni
//         const originalFileManagerData = fileManagerConfigResult.data;
//         const originalS3Data = s3ConfigResult.data;

//         // Prepara i parametri per minioContainer, includendo credenziali
//         const minioContainerParams = {
//           ...originalFileManagerData, // Include s3CustomServer, s3ServerHost, s3ServerPort
//           s3Bucket: originalS3Data.s3Bucket,
//           s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin", // Recupera da ENV o usa default
//           s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin", // Recupera da ENV o usa default
//         };

//         startedMinioContainer = await minioContainer(minioContainerParams)
//           .withNetwork(network) // `network` è definito se arriviamo qui
//           .withNetworkAliases("minio")
//           .withReuse()
//           .start();

//         // Calcola l'endpoint completo con la porta mappata
//         const s3MappedPort =
//           startedMinioContainer.getMappedPort(TEST_MINIO_PORT);
//         const s3ServerHost = "127.0.0.1"; // Host per connessioni dal Mac
//         const s3ServerEndpoint = `http://${s3ServerHost}:${s3MappedPort}`;

//         // Prepara l'oggetto di configurazione estesa da fornire
//         const minioConfigToProvide: EnhancedFileManagerConfig = {
//           ...(originalFileManagerData.s3CustomServer
//             ? {
//                 s3CustomServer: true,
//                 s3ServerHost, // La porta mappata verrà impostata qui
//                 s3ServerPort: s3MappedPort, // La porta mappata verrà impostata qui
//               }
//             : { s3CustomServer: false }), // In questo caso host/port non servono
//           s3Bucket: originalS3Data.s3Bucket,
//           s3ServerEndpoint, // <--- L'ENDPOINT COMPLETO
//           s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin", // Aggiungi credenziali per initFileManager
//           s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin", // Aggiungi credenziali per initFileManager
//         };

//         provide("fileManagerConfig", minioConfigToProvide);
//       }

//       // --- SETUP CONTAINER MAILPIT (Email Manager) ---
//       if (emailManagerConfig.success) {
//         startedMailpitContainer = await mailpitContainer()
//           .withNetwork(network)
//           .withNetworkAliases("mailpit")
//           .withReuse()
//           .start();

//         emailManagerConfig.data.smtpPort =
//           startedMailpitContainer.getMappedPort(TEST_MAILPIT_SMTP_PORT);
//         emailManagerConfig.data.mailpitAPIPort =
//           startedMailpitContainer.getMappedPort(TEST_MAILPIT_HTTP_PORT);
//         emailManagerConfig.data.smtpAddress = "127.0.0.1";

//         provide("emailManagerConfig", emailManagerConfig.data);
//       }

//       // --- SETUP CONTAINER DYNAMODB ---
//       if (tokenGenerationReadModelConfig.success) {
//         startedDynamoDbContainer = await dynamoDBContainer()
//           .withNetwork(network)
//           .withNetworkAliases("dynamodb")
//           .withReuse()
//           .start();

//         const dynamoPort =
//           startedDynamoDbContainer.getMappedPort(TEST_DYNAMODB_PORT);
//         const dynamoHost = "127.0.0.1";

//         provide("tokenGenerationReadModelConfig", {
//           ...tokenGenerationReadModelConfig.data,
//           tokenGenerationReadModelDbPort: dynamoPort,
//           tokenGenerationReadModelDbHost: dynamoHost,
//         });
//       }

//       // --- SETUP CONTAINER REDIS ---
//       if (redisRateLimiterConfig.success) {
//         startedRedisContainer = await redisContainer()
//           .withNetwork(network)
//           .withNetworkAliases("redis")
//           .withReuse()
//           .start();

//         redisRateLimiterConfig.data.rateLimiterRedisPort =
//           startedRedisContainer.getMappedPort(TEST_REDIS_PORT);
//         redisRateLimiterConfig.data.rateLimiterRedisHost = "127.0.0.1";

//         provide("redisRateLimiterConfig", redisRateLimiterConfig.data);
//       }

//       // --- SETUP CONTAINER AWS SES (Localstack/Mock) ---
//       if (awsSESConfig.success) {
//         startedAWSSesContainer = await awsSESContainer()
//           .withNetwork(network)
//           .withNetworkAliases("aws-ses")
//           .withReuse()
//           .start();

//         provide("sesEmailManagerConfig", {
//           awsRegion: awsSESConfig.data.awsRegion,
//           awsSesEndpoint: `http://127.0.0.1:${startedAWSSesContainer.getMappedPort(
//             TEST_AWS_SES_PORT
//           )}`,
//         });
//       }

//       // La funzione di cleanup globale si occupa solo di fermare i container e la rete.
//       // La chiusura dei client di database e la pulizia dei dati
//       // sono gestite dalla funzione `cleanup` fornita da `setupTestContainersVitest.ts` nei singoli test.
//       return async () => {
//         console.log("Cleaning up containers and network...");
//         await startedPostgreSqlContainer?.stop();
//         await startedPostgreSqlReadModelContainer?.stop();
//         await startedPostgreSqlAnalyticsContainer?.stop();
//         await startedMongodbContainer?.stop();
//         await startedMinioContainer?.stop();
//         await startedMailpitContainer?.stop();
//         await startedDynamoDbContainer?.stop();
//         await startedRedisContainer?.stop();
//         await startedAWSSesContainer?.stop();
//         await network?.stop();
//         console.log("Containers and network stopped.");
//       };
//     } catch (error) {
//       console.error("Error in global setup:", error);
//       console.log("Keeping containers alive for debug for 90 seconds...");
//       // Puoi rimuovere o regolare questo timeout di debug una volta che tutto funziona
//       await new Promise((resolve) => setTimeout(resolve, 90000));
//       throw error;
//     }
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
  FileManagerConfig as OriginalFileManagerConfig,
  ReadModelDbConfig,
  ReadModelSQLDbConfig,
  RedisRateLimiterConfig,
  S3Config as OriginalS3Config,
  TokenGenerationReadModelDbConfig,
} from "pagopa-interop-commons";
import { Network, StartedNetwork, StartedTestContainer } from "testcontainers";
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

// --- Definizioni di tipi estese e importazioni Zod ---

// Importa le definizioni originali FileManagerConfig e S3Config dal tuo commons

// Definisci un tipo per LoggerConfig se non è già importato o disponibile
// Questo è necessario perché initFileManager lo richiede
const LoggerConfig = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]),
});
type LoggerConfig = z.infer<typeof LoggerConfig>;

// Estendi il tipo per includere credenziali S3 e l'endpoint completo
// PER AGGIRARE initFileManager:
// s3ServerHost conterrà l'URL completo (es. http://127.0.0.1:9000)
// s3ServerPort sarà impostato a 80 (o 443) per non rompere la concatenazione di initFileManager
const EnhancedFileManagerConfig = OriginalFileManagerConfig.and(
  OriginalS3Config // Unisci le proprietà di S3Config direttamente qui
).and(
  z.object({
    s3AccessKeyId: z.string(), // Queste credenziali DEVONO essere definite
    s3SecretAccessKey: z.string(), // poiché initFileManager non le prende da FileManagerConfig
  })
);
type EnhancedFileManagerConfig = z.infer<typeof EnhancedFileManagerConfig>;

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

// --- Dichiarazioni di contesto Vitest ---

declare module "vitest" {
  export interface ProvidedContext {
    readModelConfig?: ReadModelDbConfig;
    readModelSQLConfig?: ReadModelSQLDbConfig;
    tokenGenerationReadModelConfig?: EnhancedTokenGenerationReadModelDbConfig;
    eventStoreConfig?: EventStoreConfig;
    fileManagerConfig?: EnhancedFileManagerConfig & LoggerConfig; // Aggiungi LoggerConfig
    redisRateLimiterConfig?: RedisRateLimiterConfig;
    emailManagerConfig?: PecEmailManagerConfigTest;
    sesEmailManagerConfig?: AWSSesConfig;
    analyticsSQLDbConfig?: AnalyticsSQLDbConfig;
  }
}

// --- Funzione di setup globale ---

export function setupTestContainersVitestGlobal() {
  console.log("ESEGUITOOOOOOOOO");

  dotenv();

  // Parsing di tutte le configurazioni iniziali
  const eventStoreConfig = EventStoreConfig.safeParse(process.env);
  const readModelConfig = ReadModelDbConfig.safeParse(process.env);
  const readModelSQLConfig = ReadModelSQLDbConfig.safeParse(process.env);
  const analyticsSQLDbConfig = AnalyticsSQLDbConfig.safeParse(process.env);
  const fileManagerConfigResult = OriginalFileManagerConfig.safeParse(
    process.env
  );
  const s3ConfigResult = OriginalS3Config.safeParse(process.env);
  const loggerConfigResult = LoggerConfig.safeParse(process.env); // Per il logLevel in initFileManager
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

    try {
      console.log("Creating Docker network...");
      network = await new Network().start();
      console.log("Network created:", network.getName());

      const packageGroup = process.env.PACKAGE_GROUP ?? "default-package";
      const dbNamePrefix = `testdb-${packageGroup}`;

      // ... (Resto delle configurazioni dei container che non sono MinIO rimangono invariate) ...
      // --- SETUP CONTAINER EVENT STORE (PostgreSQL) --- (INVARIATO)
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
            eventStoreDbUsername: "root",
            eventStoreDbPassword:
              eventStoreConfig.data.eventStoreDbPassword || "root",
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
            "with host: 127.0.0.1",
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
        eventStoreConfig.data.eventStoreDbHost = "127.0.0.1";
        eventStoreConfig.data.eventStoreDbName = `${dbNamePrefix}-eventstore`;
        eventStoreConfig.data.eventStoreDbUsername = "root";
        eventStoreConfig.data.eventStoreDbPassword =
          eventStoreConfig.data.eventStoreDbPassword || "root";

        provide("eventStoreConfig", eventStoreConfig.data);
      }

      // --- SETUP CONTAINER READ MODEL SQL (PostgreSQL) --- (INVARIATO)
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
        readModelSQLConfig.data.readModelSQLDbHost = "127.0.0.1";
        readModelSQLConfig.data.readModelSQLDbName = `${dbNamePrefix}-readmodel`;

        provide("readModelSQLConfig", readModelSQLConfig.data);
      }

      // --- SETUP CONTAINER ANALYTICS SQL (PostgreSQL) --- (INVARIATO)
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
        analyticsSQLDbConfig.data.dbHost = "127.0.0.1";
        analyticsSQLDbConfig.data.dbName = `${dbNamePrefix}-analytics`;

        provide("analyticsSQLDbConfig", analyticsSQLDbConfig.data);
      }

      // --- SETUP CONTAINER MONGODB --- (INVARIATO)
      if (readModelConfig.success) {
        startedMongodbContainer = await mongoDBContainer(readModelConfig.data)
          .withNetwork(network)
          .withNetworkAliases("mongodb")
          .withReuse()
          .start();

        readModelConfig.data.readModelDbPort =
          startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
        readModelConfig.data.readModelDbHost = "127.0.0.1";

        provide("readModelConfig", readModelConfig.data);
      }

      // --- SETUP CONTAINER MINIO (S3) --- (MODIFICATO SIGNIFICATIVAMENTE)
      if (
        fileManagerConfigResult.success &&
        s3ConfigResult.success &&
        loggerConfigResult.success
      ) {
        const originalFileManagerData = fileManagerConfigResult.data;
        const originalS3Data = s3ConfigResult.data;
        const loggerData = loggerConfigResult.data; // Ottieni il logLevel

        // Prepara i parametri per minioContainer, includendo credenziali
        // Queste sono le credenziali che MinIO stesso usa per l'autenticazione interna.
        const minioAccessKeyId = "testawskey";
        const minioSecretAccessKey = "testawssecret";

        const minioContainerParams = {
          ...originalFileManagerData, // Include s3CustomServer
          s3Bucket: originalS3Data.s3Bucket,
          s3AccessKeyId: minioAccessKeyId,
          s3SecretAccessKey: minioSecretAccessKey,
        };

        startedMinioContainer = await minioContainer(minioContainerParams)
          .withNetwork(network) // `network` è definito se arriviamo qui
          .withNetworkAliases("minio")
          .withReuse()
          .start();

        const s3MappedPort =
          startedMinioContainer.getMappedPort(TEST_MINIO_PORT);
        const s3Host = "127.0.0.1";
        // Costruisci l'URL completo che initFileManager si aspetta in `config.s3ServerHost`
        const s3FullEndpointUrl = `http://${s3Host}:${s3MappedPort}`;

        // Prepara l'oggetto di configurazione estesa da fornire a initFileManager
        // Questo è il HACK per aggirare l'initFileManager NON modificabile:
        // - s3ServerHost conterrà l'URL COMPLETO (es. http://127.0.0.1:9000)
        // - s3ServerPort verrà impostato a 80 (o 443) per non generare un URL malformato
        //   quando initFileManager concatena `${config.s3ServerHost}:${config.s3ServerPort}`
        // - Le credenziali (s3AccessKeyId, s3SecretAccessKey) vengono aggiunte qui perché
        //   il tuo initFileManager non le prende da FileManagerConfig direttamente, ma il S3Client le vuole
        const minioConfigToProvide: EnhancedFileManagerConfig & LoggerConfig = {
          s3CustomServer: true, // Deve essere true affinché initFileManager usi l'endpoint custom
          s3ServerHost: s3FullEndpointUrl, // <--- HACK: INIETTA L'URL COMPLETO QUI
          s3ServerPort: 80, // <--- HACK: Porta fittizia per evitare errore di concatenazione
          s3Bucket: originalS3Data.s3Bucket,
          s3AccessKeyId: minioAccessKeyId, // Credenziali passate per S3Client
          s3SecretAccessKey: minioSecretAccessKey, // Credenziali passate per S3Client
          logLevel: loggerData.logLevel, // Passa il logLevel
        };

        provide("fileManagerConfig", minioConfigToProvide);
      }

      // --- SETUP CONTAINER MAILPIT (Email Manager) --- (INVARIATO)
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
        emailManagerConfig.data.smtpAddress = "127.0.0.1";

        provide("emailManagerConfig", emailManagerConfig.data);
      }

      // --- SETUP CONTAINER DYNAMODB --- (INVARIATO)
      if (tokenGenerationReadModelConfig.success) {
        startedDynamoDbContainer = await dynamoDBContainer()
          .withNetwork(network)
          .withNetworkAliases("dynamodb")
          .withReuse()
          .start();

        const dynamoPort =
          startedDynamoDbContainer.getMappedPort(TEST_DYNAMODB_PORT);
        const dynamoHost = "127.0.0.1";

        provide("tokenGenerationReadModelConfig", {
          ...tokenGenerationReadModelConfig.data,
          tokenGenerationReadModelDbPort: dynamoPort,
          tokenGenerationReadModelDbHost: dynamoHost,
        });
      }

      // --- SETUP CONTAINER REDIS --- (INVARIATO)
      if (redisRateLimiterConfig.success) {
        startedRedisContainer = await redisContainer()
          .withNetwork(network)
          .withNetworkAliases("redis")
          .withReuse()
          .start();

        redisRateLimiterConfig.data.rateLimiterRedisPort =
          startedRedisContainer.getMappedPort(TEST_REDIS_PORT);
        redisRateLimiterConfig.data.rateLimiterRedisHost = "127.0.0.1";

        provide("redisRateLimiterConfig", redisRateLimiterConfig.data);
      }

      // --- SETUP CONTAINER AWS SES (Localstack/Mock) --- (INVARIATO)
      if (awsSESConfig.success) {
        startedAWSSesContainer = await awsSESContainer()
          .withNetwork(network)
          .withNetworkAliases("aws-ses")
          .withReuse()
          .start();

        provide("sesEmailManagerConfig", {
          awsRegion: awsSESConfig.data.awsRegion,
          awsSesEndpoint: `http://127.0.0.1:${startedAWSSesContainer.getMappedPort(
            TEST_AWS_SES_PORT
          )}`,
        });
      }

      // La funzione di cleanup globale si occupa solo di fermare i container e la rete.
      return async () => {
        console.log("Cleaning up containers and network...");
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
        console.log("Containers and network stopped.");
      };
    } catch (error) {
      console.error("Error in global setup:", error);
      console.log("Keeping containers alive for debug for 90 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 90000));
      throw error;
    }
  };
}

// packages/catalog-process/test/vitestIntegrationGlobalSetup.ts (o il percorso corretto nel tuo monorepo)

/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable max-params */

// packages/catalog-process/test/vitestIntegrationGlobalSetup.ts (o il percorso corretto nel tuo monorepo)

/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable max-params */

// import {
//   FileManagerConfig,
//   LoggerConfig,
//   ReadModelDbConfig,
//   EventStoreConfig,
//   S3Config, // Questo sarà il tuo schema Zod trasformato (e il tipo)
//   RedisRateLimiterConfig,
//   AWSSesConfig,
//   ReadModelSQLDbConfig,
//   AnalyticsSQLDbConfig,
//   genericLogger, // Assicurati che genericLogger sia importato correttamente
// } from "pagopa-interop-commons"; // AGGIUSTA IL PERCORSO PER I TUOI SCHEMI E TIPI DI CONFIGURAZIONE

// import type { TestProject } from "vitest/node";

// import { StartedTestContainer, StartedNetwork, Network } from "testcontainers";
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

// import { config as dotenv } from "dotenv-flow";
// import { parseConfig, ConfigParseResult } from "./parseConfig.js";

// // Importa tutti i container e le costanti dal tuo containerTestUtils.ts
// import {
//   mongoDBContainer,
//   postgreSQLContainer,
//   postgreSQLReadModelContainer,
//   dynamoDBContainer,
//   minioContainer,
//   mailpitContainer,
//   redisContainer,
//   awsSESContainer,
//   postgreSQLAnalyticsContainer,
//   TEST_MONGO_DB_PORT,
//   TEST_POSTGRES_DB_PORT,
//   TEST_DYNAMODB_PORT,
//   TEST_MINIO_PORT,
//   TEST_MAILPIT_HTTP_PORT,
//   TEST_MAILPIT_SMTP_PORT,
//   TEST_REDIS_PORT,
//   TEST_AWS_SES_PORT,
// } from "./containerTestUtils.js"; // AGGIUSTA IL PERCORSO SE DIVERSO

// // Importa le funzioni per setup/teardown di DynamoDB
// import {
//   buildDynamoDBTables,
//   deleteDynamoDBTables,
// } from "./setupDynamoDBtables.js"; // AGGIUSTA IL PERCORSO SE DIVERSO

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable complexity */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

// packages/catalog-process/test/vitestIntegrationGlobalSetup.ts

/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable max-params */

// import {
//   // Importa i tuoi schemi Zod con il nome che hai dato loro (es. S3Config è lo schema trasformato)
//   S3Config,
//   FileManagerConfig,
//   LoggerConfig,
//   ReadModelDbConfig,
//   EventStoreConfig,
//   RedisRateLimiterConfig,
//   AWSSesConfig,
//   ReadModelSQLDbConfig,
//   AnalyticsSQLDbConfig,
//   // Assicurati che TokenGenerationReadModelDbConfigSchema e PecEmailManagerConfigTestSchema
//   // siano importati correttamente se sono schemi Zod che parsano dall'ambiente
//   // Se non sono schemi Zod, ma solo interfacce per i test, non importa gli schemi qui.
//   TokenGenerationReadModelDbConfig as TokenGenerationReadModelDbConfigSchema, // Rinomina per chiarezza se il tuo tipo e schema hanno lo stesso nome
//   PecEmailManagerConfig as PecEmailManagerConfigTestSchema, // Rinomina per chiarezza
// } from "pagopa-interop-commons"; // AGGIUSTA QUESTO PERCORSO

// import { config as dotenv } from "dotenv-flow";

// // Importa i tipi estesi per Vitest's ProvidedContext
// // import {
// //   EnhancedReadModelDbConfig,
// //   EnhancedFileManagerConfig,
// //   PecEmailManagerConfigTest, // Importa il tipo per PecEmailManagerConfigTest
// //   TokenGenerationReadModelDbConfig, // Importa il tipo per TokenGenerationReadModelDbConfig
// // } from "vitest"; // <-- Vitest li raccoglie dal tuo 'declare module'

// import {
//   StartedTestContainer,
//   StartedNetwork,
//   Network,
//   // Rimuovi TestProject dal destructuring qui, non ci serve per il provide di Vitest
// } from "testcontainers";
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

// import {
//   mongoDBContainer,
//   postgreSQLContainer,
//   postgreSQLReadModelContainer,
//   dynamoDBContainer,
//   minioContainer,
//   mailpitContainer,
//   redisContainer,
//   awsSESContainer,
//   postgreSQLAnalyticsContainer,
//   TEST_MONGO_DB_PORT,
//   TEST_POSTGRES_DB_PORT,
//   TEST_DYNAMODB_PORT,
//   TEST_MINIO_PORT,
//   TEST_MAILPIT_HTTP_PORT,
//   TEST_MAILPIT_SMTP_PORT,
//   TEST_REDIS_PORT,
//   TEST_AWS_SES_PORT,
// } from "./containerTestUtils.js"; // AGGIUSTA IL PERCORSO SE DIVERSO

// import { buildDynamoDBTables } from "./setupDynamoDBtables.js"; // AGGIUSTA IL PERCORSO SE DIVERSO

// interface EnhancedReadModelDbConfig extends ReadModelDbConfig {
//   readModelDbReplicaSet?: string; // Aggiungi questa proprietà, rendendola opzionale
// }

// // Questo è l'hack necessario per FileManagerConfig, combinando parti di S3Config e LoggerConfig
// type EnhancedFileManagerConfig = FileManagerConfig &
//   S3Config & {
//     s3AccessKeyId: string;
//     s3SecretAccessKey: string;
//     s3ServerHost: string; // Sarà l'URL completo del MinIO mappato
//     s3ServerPort: number; // La porta fittizia (80) per la concatenazione
//     logLevel: LoggerConfig["logLevel"]; // Il logLevel dal LoggerConfig
//   };

// // Aggiungi un tipo per la tua config TokenGenerationReadModelDbConfig se non l'hai già
// // Esempio (assumendo sia simile a ReadModelDbConfig ma per DynamoDB):
// interface TokenGenerationReadModelDbConfig {
//   tokenGenerationReadModelDbHost: string;
//   tokenGenerationReadModelDbPort: number;
//   // Aggiungi qui altre proprietà del tuo schema TokenGenerationReadModelDbConfig se presenti
// }

// // Tipo per PecEmailManagerConfigTest, se è un tipo custom che usi per il test
// interface PecEmailManagerConfigTest {
//   smtpAddress: string;
//   smtpPort: number;
//   mailpitAPIPort: number;
//   smtpUsername?: string;
//   smtpPassword?: string;
//   smtpRequireAuth?: boolean;
//   smtpSecure?: boolean;
// }

// // Tipo per AWSSesConfig (se non è già definito nello schema trasformato, ma sembra che lo sia)
// // Potrebbe essere solo z.infer<typeof AWSSesConfig>

// declare module "vitest" {
//   export interface ProvidedContext {
//     readModelConfig?: EnhancedReadModelDbConfig; // Usa il tipo esteso
//     readModelSQLConfig?: ReadModelSQLDbConfig;
//     tokenGenerationReadModelConfig?: TokenGenerationReadModelDbConfig; // Assumi che questo sia il tipo finale dopo il parsing
//     eventStoreConfig?: EventStoreConfig;
//     fileManagerConfig?: EnhancedFileManagerConfig; // Usa il tipo esteso
//     redisRateLimiterConfig?: RedisRateLimiterConfig;
//     emailManagerConfig?: PecEmailManagerConfigTest;
//     sesEmailManagerConfig?: AWSSesConfig; // Questo dovrebbe essere il tipo inferito dallo schema AWSSesConfig
//     analyticsSQLDbConfig?: AnalyticsSQLDbConfig;
//     // Aggiungi qui qualsiasi client AWS o altro che vuoi rendere disponibile
//     dynamoDBClient?: import("@aws-sdk/client-dynamodb").DynamoDBClient;
//     s3Client?: import("@aws-sdk/client-s3").S3Client;
//   }
// }

// // Definizione della funzione `provide` per Vitest, secondo la tua ProvidedContext
// // Questo è il cuore della soluzione per l'errore 'never'
// interface VitestGlobalSetupContext {
//   provide: <K extends keyof import("vitest").ProvidedContext>(
//     key: K,
//     value: import("vitest").ProvidedContext[K]
//   ) => void;
// }

// export function setupTestContainersVitestGlobal() {
//   dotenv(); // Usa .config() per caricare dal .env

//   console.log("--- Starting global setup: Parsing configurations... ---");

//   // Usa .safeParse() direttamente sui tuoi schemi Zod
//   const eventStoreConfigResult = EventStoreConfig.safeParse(process.env);
//   const readModelConfigResult = ReadModelDbConfig.safeParse(process.env);
//   const readModelSQLConfigResult = ReadModelSQLDbConfig.safeParse(process.env);
//   const analyticsSQLDbConfigResult = AnalyticsSQLDbConfig.safeParse(
//     process.env
//   );
//   const fileManagerConfigResult = FileManagerConfig.safeParse(process.env); // Usare lo schema Zod trasformato
//   const s3ConfigResult = S3Config.safeParse(process.env); // Usare lo schema Zod trasformato
//   const loggerConfigResult = LoggerConfig.safeParse(process.env);
//   const redisRateLimiterConfigResult = RedisRateLimiterConfig.safeParse(
//     process.env
//   );
//   const emailManagerConfigResult = PecEmailManagerConfigTestSchema.safeParse(
//     process.env
//   ); // Schema Zod per PecEmailManagerConfigTest
//   const awsSESConfigResult = AWSSesConfig.safeParse(process.env);
//   const tokenGenerationReadModelConfigResult =
//     TokenGenerationReadModelDbConfigSchema.safeParse(process.env);

//   // Restituisci la funzione async che Vitest eseguirà
//   return async function ({
//     provide, // Ora 'provide' sarà correttamente tipizzato grazie all'interfaccia VitestGlobalSetupContext
//   }: VitestGlobalSetupContext): Promise<() => Promise<void>> {
//     let startedPostgreSqlContainer: StartedTestContainer | undefined;
//     let startedPostgreSqlReadModelContainer: StartedTestContainer | undefined;
//     let startedPostgreSqlAnalyticsContainer: StartedTestContainer | undefined;
//     let startedMongodbContainer: StartedTestContainer | undefined;
//     let startedMinioContainer: StartedTestContainer | undefined;
//     let startedMailpitContainer: StartedTestContainer | undefined;
//     let startedRedisContainer: StartedTestContainer | undefined;
//     let startedDynamoDbContainer: StartedTestContainer | undefined;
//     let startedAWSSesContainer: StartedTestContainer | undefined;
//     let network: StartedNetwork | undefined;

//     try {
//       console.log("Creating Docker network...");
//       network = await new Network().start();
//       console.log("Network created:", network.getName());

//       const packageGroup = process.env.PACKAGE_GROUP ?? "default-package";
//       const dbNamePrefix = `testdb-${packageGroup}`;

//       // --- SETUP CONTAINER EVENT STORE (PostgreSQL) ---
//       if (eventStoreConfigResult.success) {
//         console.log("Event store config:", {
//           username: eventStoreConfigResult.data.eventStoreDbUsername,
//           password: eventStoreConfigResult.data.eventStoreDbPassword
//             ? "[REDACTED]"
//             : "undefined",
//           dbName: `${dbNamePrefix}-eventstore`,
//         });

//         console.log("Starting PostgreSQL container for event store...");
//         try {
//           startedPostgreSqlContainer = await postgreSQLContainer({
//             ...eventStoreConfigResult.data,
//             eventStoreDbName: `${dbNamePrefix}-eventstore`,
//             // Assicurati che queste credenziali siano quelle che il container si aspetta e che siano gestite dallo schema
//             eventStoreDbUsername: "root",
//             eventStoreDbPassword:
//               eventStoreConfigResult.data.eventStoreDbPassword || "root",
//           })
//             .withNetwork(network)
//             .withNetworkAliases("postgres-eventstore")
//             .withEnvironment({
//               POSTGRES_USER: "root",
//               POSTGRES_PASSWORD:
//                 eventStoreConfigResult.data.eventStoreDbPassword || "root",
//               POSTGRES_DB: `${dbNamePrefix}-eventstore`,
//             })
//             .withHealthCheck({
//               test: ["CMD-SHELL", "pg_isready -U root"],
//               interval: 1000,
//               timeout: 5000,
//               retries: 5,
//               startPeriod: 5000,
//             })
//             .start();
//           console.log(
//             "PostgreSQL container started:",
//             startedPostgreSqlContainer.getId(),
//             "on port:",
//             startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT),
//             "with host: 127.0.0.1",
//             "in network:",
//             network.getName(),
//             "network aliases:",
//             startedPostgreSqlContainer.getNetworkNames()
//           );
//         } catch (error) {
//           console.error("Failed to start PostgreSQL container:", error);
//           throw error;
//         }

//         // Modifica l'oggetto data e poi forniscilo
//         const configuredEventStoreConfig = {
//           ...eventStoreConfigResult.data,
//           eventStoreDbPort: startedPostgreSqlContainer.getMappedPort(
//             TEST_POSTGRES_DB_PORT
//           ),
//           eventStoreDbHost: "127.0.0.1",
//           eventStoreDbName: `${dbNamePrefix}-eventstore`,
//           eventStoreDbUsername: "root",
//           eventStoreDbPassword:
//             eventStoreConfigResult.data.eventStoreDbPassword || "root",
//         };
//         provide("eventStoreConfig", configuredEventStoreConfig);
//       }

//       // --- SETUP CONTAINER READ MODEL SQL (PostgreSQL) ---
//       if (readModelSQLConfigResult.success) {
//         startedPostgreSqlReadModelContainer =
//           await postgreSQLReadModelContainer({
//             ...readModelSQLConfigResult.data,
//             readModelSQLDbName: `${dbNamePrefix}-readmodel`,
//           })
//             .withNetwork(network)
//             .withNetworkAliases("postgres-readmodel")
//             .withReuse()
//             .start();

//         const configuredReadModelSQLConfig = {
//           ...readModelSQLConfigResult.data,
//           readModelSQLDbPort: startedPostgreSqlReadModelContainer.getMappedPort(
//             TEST_POSTGRES_DB_PORT
//           ),
//           readModelSQLDbHost: "127.0.0.1",
//           readModelSQLDbName: `${dbNamePrefix}-readmodel`,
//         };
//         provide("readModelSQLConfig", configuredReadModelSQLConfig);
//       }

//       // --- SETUP CONTAINER ANALYTICS SQL (PostgreSQL) ---
//       if (analyticsSQLDbConfigResult.success) {
//         startedPostgreSqlAnalyticsContainer =
//           await postgreSQLAnalyticsContainer({
//             ...analyticsSQLDbConfigResult.data,
//             dbName: `${dbNamePrefix}-analytics`,
//           })
//             .withNetwork(network)
//             .withNetworkAliases("postgres-analytics")
//             .withReuse()
//             .start();

//         const configuredAnalyticsSQLDbConfig = {
//           ...analyticsSQLDbConfigResult.data,
//           dbPort: startedPostgreSqlAnalyticsContainer.getMappedPort(
//             TEST_POSTGRES_DB_PORT
//           ),
//           dbHost: "127.0.0.1",
//           dbName: `${dbNamePrefix}-analytics`,
//         };
//         provide("analyticsSQLDbConfig", configuredAnalyticsSQLDbConfig);
//       }

//       // --- SETUP CONTAINER MONGODB ---
//       if (readModelConfigResult.success) {
//         startedMongodbContainer = await mongoDBContainer(
//           readModelConfigResult.data
//         )
//           .withNetwork(network)
//           .withNetworkAliases("mongodb")
//           .withReuse()
//           .start();

//         const configuredReadModelConfig: EnhancedReadModelDbConfig = {
//           // Usa il tipo esteso qui
//           ...readModelConfigResult.data,
//           readModelDbPort:
//             startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT),
//           readModelDbHost: "127.0.0.1",
//           readModelDbReplicaSet: `mongodb://127.0.0.1:${startedMongodbContainer.getMappedPort(
//             TEST_MONGO_DB_PORT
//           )}`, // Esempio: aggiungi replicaSet
//         };
//         provide("readModelConfig", configuredReadModelConfig);
//       }

//       // --- SETUP CONTAINER MINIO (S3) ---
//       if (
//         fileManagerConfigResult.success &&
//         s3ConfigResult.success &&
//         loggerConfigResult.success
//       ) {
//         const originalFileManagerData = fileManagerConfigResult.data; // È già il tipo trasformato
//         const originalS3Data = s3ConfigResult.data; // È già il tipo trasformato
//         const loggerData = loggerConfigResult.data;

//         const minioAccessKeyId = "testawskey"; // O qualsiasi sia nel containerTestUtils.ts
//         const minioSecretAccessKey = "testawssecret"; // O qualsiasi sia nel containerTestUtils.ts

//         // `minioContainerParams` dovrebbe usare i dati originalFileManagerData
//         // e s3Bucket da originalS3Data. Non c'è bisogno di Enhanced qui.
//         const minioContainerParams = {
//           ...originalFileManagerData,
//           s3Bucket: originalS3Data.s3Bucket, // Viene aggiunto per il container
//           s3AccessKeyId: minioAccessKeyId,
//           s3SecretAccessKey: minioSecretAccessKey,
//         };

//         startedMinioContainer = await minioContainer(minioContainerParams)
//           .withNetwork(network)
//           .withNetworkAliases("minio")
//           .withReuse()
//           .start();

//         const s3MappedPort =
//           startedMinioContainer.getMappedPort(TEST_MINIO_PORT);
//         const s3Host = "127.0.0.1";
//         const s3FullEndpointUrl = `http://${s3Host}:${s3MappedPort}`;

//         // Prepara l'oggetto di configurazione estesa da fornire a initFileManager
//         const minioConfigToProvide: EnhancedFileManagerConfig = {
//           // Prendi le proprietà dal FileManagerConfig trasformato
//           ...originalFileManagerData,
//           // Sovrascrivi/aggiungi le proprietà relative al setup MinIO
//           s3CustomServer: true,
//           s3ServerHost: s3FullEndpointUrl,
//           s3ServerPort: 80, // Porta interna MinIO
//           s3Bucket: originalS3Data.s3Bucket,
//           s3AccessKeyId: minioAccessKeyId,
//           s3SecretAccessKey: minioSecretAccessKey,
//           logLevel: loggerData.logLevel, // Dal loggerConfigResult
//         };

//         provide("fileManagerConfig", minioConfigToProvide);

//         // --- Crea il bucket MinIO ---
//         try {
//           console.log(
//             `Attempting to create/verify MinIO bucket "${originalS3Data.s3Bucket}"...`
//           );
//           const tempS3Client = new S3Client({
//             endpoint: s3FullEndpointUrl,
//             forcePathStyle: true,
//             credentials: {
//               accessKeyId: minioAccessKeyId,
//               secretAccessKey: minioSecretAccessKey,
//             },
//             logger: console,
//           });
//           await tempS3Client.send(
//             new CreateBucketCommand({ Bucket: originalS3Data.s3Bucket })
//           );
//           console.log(
//             `MinIO bucket "${originalS3Data.s3Bucket}" created successfully (or already exists).`
//           );
//           provide("s3Client", tempS3Client); // Fornisci anche il client S3
//         } catch (bucketError: any) {
//           if (bucketError.name === "BucketAlreadyOwnedByYou") {
//             console.warn(
//               `MinIO bucket "${originalS3Data.s3Bucket}" already exists, skipping creation.`
//             );
//           } else {
//             console.error(
//               `Error creating MinIO bucket "${originalS3Data.s3Bucket}":`,
//               bucketError
//             );
//             throw bucketError;
//           }
//         }
//       }

//       // --- SETUP CONTAINER MAILPIT (Email Manager) ---
//       if (emailManagerConfigResult.success) {
//         startedMailpitContainer = await mailpitContainer()
//           .withNetwork(network)
//           .withNetworkAliases("mailpit")
//           .withReuse()
//           .start();

//         const configuredEmailManagerConfig: PecEmailManagerConfigTest = {
//           ...emailManagerConfigResult.data,
//           smtpPort: startedMailpitContainer.getMappedPort(
//             TEST_MAILPIT_SMTP_PORT
//           ),
//           mailpitAPIPort: startedMailpitContainer.getMappedPort(
//             TEST_MAILPIT_HTTP_PORT
//           ),
//           smtpAddress: "127.0.0.1",
//         };

//         provide("emailManagerConfig", configuredEmailManagerConfig);
//       }

//       // --- SETUP CONTAINER DYNAMODB ---
//       if (tokenGenerationReadModelConfigResult.success) {
//         startedDynamoDbContainer = await dynamoDBContainer()
//           .withNetwork(network)
//           .withNetworkAliases("dynamodb")
//           .withReuse()
//           .start();

//         const dynamoPort =
//           startedDynamoDbContainer.getMappedPort(TEST_DYNAMODB_PORT);
//         const dynamoHost = "127.0.0.1";

//         const configuredTokenGenerationReadModelConfig: TokenGenerationReadModelDbConfig =
//           {
//             ...tokenGenerationReadModelConfigResult.data,
//             tokenGenerationReadModelDbPort: dynamoPort,
//             tokenGenerationReadModelDbHost: dynamoHost,
//           };
//         provide(
//           "tokenGenerationReadModelConfig",
//           configuredTokenGenerationReadModelConfig
//         );

//         // Inizializza DynamoDBClient e forniscilo
//         const dynamoDBClient = new DynamoDBClient({
//           endpoint: `http://${dynamoHost}:${dynamoPort}`,
//           region: "eu-south-1",
//           credentials: { accessKeyId: "test", secretAccessKey: "test" },
//         });
//         provide("dynamoDBClient", dynamoDBClient);

//         // Crea le tabelle DynamoDB
//         console.log("Building DynamoDB tables...");
//         await buildDynamoDBTables(dynamoDBClient);
//         console.log("DynamoDB tables built successfully.");
//       }

//       // --- SETUP CONTAINER REDIS ---
//       if (redisRateLimiterConfigResult.success) {
//         startedRedisContainer = await redisContainer()
//           .withNetwork(network)
//           .withNetworkAliases("redis")
//           .withReuse()
//           .start();

//         const configuredRedisRateLimiterConfig = {
//           ...redisRateLimiterConfigResult.data,
//           rateLimiterRedisPort:
//             startedRedisContainer?.getMappedPort(TEST_REDIS_PORT) ?? 6379, // Fallback a 6379 se non mappato
//           rateLimiterRedisHost: "127.0.0.1",
//         };
//         provide("redisRateLimiterConfig", configuredRedisRateLimiterConfig);
//       }

//       // --- SETUP CONTAINER AWS SES (Localstack/Mock) ---
//       if (awsSESConfigResult.success) {
//         startedAWSSesContainer = await awsSESContainer()
//           .withNetwork(network)
//           .withNetworkAliases("aws-ses")
//           .withReuse()
//           .start();

//         const configuredAwsSESConfig = {
//           ...awsSESConfigResult.data,
//           awsSesEndpoint: `http://127.0.0.1:${startedAWSSesContainer.getMappedPort(
//             TEST_AWS_SES_PORT
//           )}`,
//         };
//         provide("sesEmailManagerConfig", configuredAwsSESConfig);
//       }

//       // La funzione di cleanup globale si occupa solo di fermare i container e la rete.
//       return async () => {
//         console.log("Cleaning up containers and network...");
//         await startedPostgreSqlContainer?.stop();
//         await startedPostgreSqlReadModelContainer?.stop();
//         await startedPostgreSqlAnalyticsContainer?.stop();
//         await startedMongodbContainer?.stop();
//         await startedMinioContainer?.stop();
//         await startedMailpitContainer?.stop();
//         await startedDynamoDbContainer?.stop();
//         await startedRedisContainer?.stop();
//         await startedAWSSesContainer?.stop();
//         await network?.stop();
//         console.log("Containers and network stopped.");
//       };
//     } catch (error) {
//       console.error("Error in global setup:", error);
//       console.log("Keeping containers alive for debug for 90 seconds...");
//       await new Promise((resolve) => setTimeout(resolve, 90000));
//       throw error;
//     }
//   };
// }
