/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
// import { StartedTestContainer } from "testcontainers";
// import type {} from "vitest";
// import type { GlobalSetupContext } from "vitest/node";
// import { z } from "zod";
// import {
//   awsSESContainer,
//   dynamoDBContainer,
//   mailpitContainer,
//   minioContainer,
//   mongoDBContainer,
//   postgreSQLAnalyticsContainer,
//   postgreSQLContainer,
//   postgreSQLReadModelContainer,
//   redisContainer,
//   TEST_AWS_SES_PORT,
//   TEST_DYNAMODB_PORT,
//   TEST_MAILPIT_HTTP_PORT,
//   TEST_MAILPIT_SMTP_PORT,
//   TEST_MINIO_PORT,
//   TEST_MONGO_DB_PORT,
//   TEST_POSTGRES_DB_PORT,
//   TEST_REDIS_PORT,
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
// dotenv();
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
// import type {} from "vitest";
// import type { TestProject } from "vitest/node";
// import { z } from "zod";
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

// export function setupTestContainersVitestGlobal() {
//   // Carica anche .env.testcontainers
//   // dotenv({ node_env: "testcontainers" });
//   dotenv();
//   return async function ({
//     provide,
//   }: TestProject): Promise<() => Promise<void>> {
//     const eventStoreConfig = EventStoreConfig.safeParse(process.env);
//     if (eventStoreConfig.success) {
//       provide("eventStoreConfig", eventStoreConfig.data);
//     }

//     const readModelSQLConfig = ReadModelSQLDbConfig.safeParse(process.env);
//     if (readModelSQLConfig.success) {
//       provide("readModelSQLConfig", readModelSQLConfig.data);
//     }

//     const analyticsSQLDbConfig = AnalyticsSQLDbConfig.safeParse(process.env);
//     if (analyticsSQLDbConfig.success) {
//       provide("analyticsSQLDbConfig", analyticsSQLDbConfig.data);
//     }

//     const readModelConfig = ReadModelDbConfig.safeParse(process.env);
//     if (readModelConfig.success) {
//       provide("readModelConfig", readModelConfig.data);
//     }

//     const fileManagerConfig = FileManagerConfig.safeParse(process.env);
//     if (fileManagerConfig.success) {
//       const s3Bucket =
//         S3Config.safeParse(process.env)?.data?.s3Bucket ??
//         "interop-local-bucket";
//       provide("fileManagerConfig", {
//         ...fileManagerConfig.data,
//         s3Bucket,
//       });
//     }

//     const emailManagerConfig = PecEmailManagerConfigTest.safeParse(process.env);
//     if (emailManagerConfig.success) {
//       provide("emailManagerConfig", emailManagerConfig.data);
//     }

//     const tokenGenerationReadModelConfig =
//       EnhancedTokenGenerationReadModelDbConfig.safeParse(process.env);
//     if (tokenGenerationReadModelConfig.success) {
//       provide(
//         "tokenGenerationReadModelConfig",
//         tokenGenerationReadModelConfig.data
//       );
//     }

//     const redisRateLimiterConfig = RedisRateLimiterConfig.safeParse(
//       process.env
//     );
//     if (redisRateLimiterConfig.success) {
//       provide("redisRateLimiterConfig", redisRateLimiterConfig.data);
//     }

//     const awsSESConfig = AWSSesConfig.safeParse(process.env);
//     if (awsSESConfig.success) {
//       provide("sesEmailManagerConfig", awsSESConfig.data);
//     }

//     return async () => {
//       // Nessuna cleanup da fare, i container sono gestiti fuori da questo script
//     };
//   };
// }

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

// import { fileURLToPath } from "node:url";
// import path from "node:path";
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
// } from "pagopa-interop-commons";
// import { type ProvidedContext } from "vitest";
// import type { TestProject } from "vitest/node";
// import { z } from "zod";
// import { PecEmailManagerConfigTest } from "./testConfig.js";
// // import { dynamoDBContainer, TEST_DYNAMODB_PORT } from "./containerTestUtils.js";

// const EnhancedTokenGenerationReadModelDbConfig = z
//   .object({
//     TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM: z.string(),
//     TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION: z.string(),
//     TOKEN_GENERATION_READ_MODEL_DB_PORT: z.coerce.number(),
//   })
//   .transform((env) => ({
//     tokenGenerationReadModelTableNamePlatform:
//       env.TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM,
//     tokenGenerationReadModelTableNameTokenGeneration:
//       env.TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION,
//     tokenGenerationReadModelDbPort: env.TOKEN_GENERATION_READ_MODEL_DB_PORT,
//   }));

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

// export function setupTestContainersVitestGlobal() {
//   const packageRoot = process.cwd();
//   dotenv({ path: packageRoot });
//   console.log("✅ Loaded envs from", packageRoot);

//   return async function ({
//     provide,
//   }: TestProject): Promise<() => Promise<void>> {
//     const provideConfig = <K extends keyof ProvidedContext>(
//       label: K,
//       parser: z.SafeParseReturnType<any, ProvidedContext[K]>
//     ) => {
//       if (parser.success) {
//         provide(label, parser.data);
//         console.log(`✅ Provided ${label}`);
//       } else {
//         console.log(`ℹ️ Skipped optional config ${label}`);
//       }
//     };

//     // Configurazioni standard
//     provideConfig("eventStoreConfig", EventStoreConfig.safeParse(process.env));
//     provideConfig(
//       "readModelSQLConfig",
//       ReadModelSQLDbConfig.safeParse(process.env)
//     );
//     provideConfig(
//       "analyticsSQLDbConfig",
//       AnalyticsSQLDbConfig.safeParse(process.env)
//     );
//     provideConfig("readModelConfig", ReadModelDbConfig.safeParse(process.env));
//     provideConfig(
//       "redisRateLimiterConfig",
//       RedisRateLimiterConfig.safeParse(process.env)
//     );
//     provideConfig("sesEmailManagerConfig", AWSSesConfig.safeParse(process.env));
//     provideConfig(
//       "emailManagerConfig",
//       PecEmailManagerConfigTest.safeParse(process.env)
//     );

//     const tokenGenParsed = EnhancedTokenGenerationReadModelDbConfig.safeParse(
//       process.env
//     );
//     if (tokenGenParsed.success) {
//       provide("tokenGenerationReadModelConfig", tokenGenParsed.data);
//       console.log("✅ Provided tokenGenerationReadModelConfig from .env");
//     } else {
//       console.warn(
//         "⚠️ Failed to parse tokenGenerationReadModelConfig from .env"
//       );
//     }

//     // Configurazione FileManager + S3
//     const fileManagerParsed = FileManagerConfig.safeParse(process.env);
//     const s3Parsed = S3Config.safeParse(process.env);
//     if (fileManagerParsed.success) {
//       provide("fileManagerConfig", {
//         ...fileManagerParsed.data,
//         s3Bucket: s3Parsed.success
//           ? s3Parsed.data.s3Bucket
//           : "interop-local-bucket",
//       });
//       console.log("✅ Provided fileManagerConfig with s3Bucket");
//     } else {
//       console.warn("⚠️ Failed to provide fileManagerConfig");
//     }

//     return async () => {
//       // No cleanup logic necessary
//     };
//   };
// }

// ✅ Refactored `EnhancedTokenGenerationReadModelDbConfig`
// import { z } from "zod";
// import { config as dotenvFlow } from "dotenv-flow";
// import type { ProvidedContext } from "vitest";
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
// import type { TestProject } from "vitest/node";
// import { PecEmailManagerConfigTest } from "./testConfig.js";

// export const EnhancedTokenGenerationReadModelDbConfig =
//   TokenGenerationReadModelDbConfig.and(
//     z.object({ TOKEN_GENERATION_READ_MODEL_DB_PORT: z.coerce.number() })
//   ).transform((env) => ({
//     ...env,
//     tokenGenerationReadModelDbPort: env.TOKEN_GENERATION_READ_MODEL_DB_PORT,
//   }));

// export type EnhancedTokenGenerationReadModelDbConfig = z.infer<
//   typeof EnhancedTokenGenerationReadModelDbConfig
// >;

// // ✅ Augmentazione del contesto Vitest
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

// // ✅ Funzione di setup globale Vitest
// export function setupTestContainersVitestGlobal() {
//   const packageRoot = process.cwd();
//   dotenvFlow({ path: packageRoot });
//   console.log("✅ Loaded envs from", packageRoot);

//   return async function ({
//     provide,
//   }: TestProject): Promise<() => Promise<void>> {
//     const provideConfig = <K extends keyof ProvidedContext>(
//       label: K,
//       parser: z.SafeParseReturnType<any, ProvidedContext[K]>
//     ) => {
//       if (parser.success) {
//         provide(label, parser.data);
//         console.log(`✅ Provided ${label}`);
//       } else {
//         console.log(`ℹ️ Skipped optional config ${label}`);
//       }
//     };

//     // Configurazioni standard
//     provideConfig("eventStoreConfig", EventStoreConfig.safeParse(process.env));
//     provideConfig(
//       "readModelSQLConfig",
//       ReadModelSQLDbConfig.safeParse(process.env)
//     );
//     provideConfig(
//       "analyticsSQLDbConfig",
//       AnalyticsSQLDbConfig.safeParse(process.env)
//     );
//     provideConfig("readModelConfig", ReadModelDbConfig.safeParse(process.env));
//     provideConfig(
//       "redisRateLimiterConfig",
//       RedisRateLimiterConfig.safeParse(process.env)
//     );
//     provideConfig("sesEmailManagerConfig", AWSSesConfig.safeParse(process.env));
//     provideConfig(
//       "emailManagerConfig",
//       PecEmailManagerConfigTest.safeParse(process.env)
//     );

//     // Config opzionale per Dynamo tokenGeneration
//     const tokenGenParsed = EnhancedTokenGenerationReadModelDbConfig.safeParse(
//       process.env
//     );
//     if (tokenGenParsed.success) {
//       provide("tokenGenerationReadModelConfig", tokenGenParsed.data);
//       console.log("✅ Provided tokenGenerationReadModelConfig from .env");
//     } else {
//       console.warn(
//         "ℹ️ Skipped tokenGenerationReadModelConfig (not required if SKIP_TOKEN_READMODEL is false)"
//       );
//     }

//     // FileManager + S3
//     const fileManagerParsed = FileManagerConfig.safeParse(process.env);
//     const s3Parsed = S3Config.safeParse(process.env);
//     if (fileManagerParsed.success) {
//       provide("fileManagerConfig", {
//         ...fileManagerParsed.data,
//         s3Bucket: s3Parsed.success
//           ? s3Parsed.data.s3Bucket
//           : "interop-local-bucket",
//       });
//       console.log("✅ Provided fileManagerConfig with s3Bucket");
//     } else {
//       console.warn("⚠️ Failed to provide fileManagerConfig");
//     }

//     return async () => {
//       // Nessuna logica di cleanup necessaria
//     };
//   };
// }

// ✅ Valore da mettere nel `.env` SOLO SE usi SKIP_TOKEN_READMODEL=true
// TOKEN_GENERATION_READ_MODEL_DB_PORT=8000

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import path from "path";
import { z } from "zod";
import { config as dotenvFlow } from "dotenv-flow";
import dotenv from "dotenv";
import type { ProvidedContext } from "vitest";
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
import type { TestProject } from "vitest/node";
import { PecEmailManagerConfigTest } from "./testConfig.js";

// Enhanced config per port override da .envPort
export const EnhancedTokenGenerationReadModelDbConfig =
  TokenGenerationReadModelDbConfig.and(
    z.object({ TOKEN_GENERATION_READ_MODEL_DB_PORT: z.coerce.number() })
  ).transform((env) => ({
    ...env,
    tokenGenerationReadModelDbPort: env.TOKEN_GENERATION_READ_MODEL_DB_PORT,
  }));

export type EnhancedTokenGenerationReadModelDbConfig = z.infer<
  typeof EnhancedTokenGenerationReadModelDbConfig
>;

// ✅ Augmentazione del contesto Vitest
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
  }
}

export function setupTestContainersVitestGlobal() {
  const packageRoot = process.cwd();
  const envPortPath = path.resolve(__dirname, "../../../.envPort");

  // 1. Caricamento variabili principali con dotenv-flow
  console.log(`📂 Caricamento variabili principali da: ${packageRoot}`);
  dotenvFlow({ path: packageRoot });
  console.log("✅ Variabili principali caricate con dotenv-flow");

  // 2. Caricamento porte da .envPort
  console.log(`📂 Caricamento variabili porte da: ${envPortPath}`);
  const envPortResult = dotenv.config({ path: envPortPath, override: true });
  if (envPortResult.error) {
    console.warn(`⚠️ Impossibile caricare .envPort: ${envPortResult.error}`);
  } else {
    console.log("✅ Variabili porte caricate con override: false");
  }

  // 3. Preview log variabili principali
  console.log("🔍 Preview alcune variabili caricate:");
  console.log({
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    EVENTSTORE_DB_USERNAME: process.env.EVENTSTORE_DB_USERNAME,
    EVENTSTORE_DB_PASSWORD: process.env.EVENTSTORE_DB_PASSWORD,
    MONGO_INITDB_ROOT_USERNAME: process.env.MONGO_INITDB_ROOT_USERNAME,
    MONGO_INITDB_ROOT_PASSWORD: process.env.MONGO_INITDB_ROOT_PASSWORD,
    READMODEL_DB_USERNAME: process.env.READMODEL_DB_USERNAME,
    READMODEL_DB_PASSWORD: process.env.READMODEL_DB_PASSWORD,
    READMODEL_DB_PORT: process.env.READMODEL_DB_PORT,
  });

  return async function ({
    provide,
  }: TestProject): Promise<() => Promise<void>> {
    // Fix del tipo con callback
    const provideConfig = <K extends keyof ProvidedContext>(
      label: K,
      parseFn: () => z.SafeParseReturnType<any, ProvidedContext[K]>
    ) => {
      const parser = parseFn();
      if (parser.success) {
        provide(label, parser.data);
        console.log(`✅ Provided ${label}`);
      } else {
        console.log(`ℹ️ Skipped optional config ${label}`);
      }
    };

    // Configurazioni standard
    provideConfig("eventStoreConfig", () =>
      EventStoreConfig.safeParse(process.env)
    );
    provideConfig("readModelSQLConfig", () =>
      ReadModelSQLDbConfig.safeParse(process.env)
    );
    provideConfig("analyticsSQLDbConfig", () =>
      AnalyticsSQLDbConfig.safeParse(process.env)
    );
    provideConfig("readModelConfig", () =>
      ReadModelDbConfig.safeParse(process.env)
    );
    provideConfig("redisRateLimiterConfig", () =>
      RedisRateLimiterConfig.safeParse(process.env)
    );
    provideConfig("sesEmailManagerConfig", () =>
      AWSSesConfig.safeParse(process.env)
    );
    provideConfig("emailManagerConfig", () =>
      PecEmailManagerConfigTest.safeParse(process.env)
    );

    // Config opzionale per Dynamo tokenGeneration
    provideConfig("tokenGenerationReadModelConfig", () =>
      EnhancedTokenGenerationReadModelDbConfig.safeParse(process.env)
    );

    // FileManager + S3 combinati
    const fileManagerParsed = FileManagerConfig.safeParse(process.env);
    const s3Parsed = S3Config.safeParse(process.env);
    if (fileManagerParsed.success) {
      provide("fileManagerConfig", {
        ...fileManagerParsed.data,
        s3Bucket: s3Parsed.success
          ? s3Parsed.data.s3Bucket
          : "interop-local-bucket",
      });
      console.log("✅ Provided fileManagerConfig with s3Bucket");
    } else {
      console.warn("⚠️ Failed to provide fileManagerConfig");
    }

    return async () => {
      // Nessuna logica di cleanup necessaria
    };
  };
}
