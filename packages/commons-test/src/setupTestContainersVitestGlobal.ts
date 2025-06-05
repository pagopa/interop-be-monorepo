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

import { fileURLToPath } from "node:url";
import path from "node:path";
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
} from "pagopa-interop-commons";
import type { ProvidedContext } from "vitest";
import type { TestProject } from "vitest/node";
import { z } from "zod";
import { PecEmailManagerConfigTest } from "./testConfig.js";

const EnhancedTokenGenerationReadModelDbConfig = z
  .object({
    TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM: z.string(),
    TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION: z.string(),
    TOKEN_GENERATION_READ_MODEL_DB_PORT: z
      .string()
      .transform((val) => Number(val))
      .refine((val) => !Number.isNaN(val), { message: "Must be a number" }),
  })
  .transform((env) => ({
    tokenGenerationReadModelTableNamePlatform:
      env.TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM,
    tokenGenerationReadModelTableNameTokenGeneration:
      env.TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION,
    tokenGenerationReadModelDbPort: env.TOKEN_GENERATION_READ_MODEL_DB_PORT,
  }));

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
  }
}

export function setupTestContainersVitestGlobal() {
  const monorepoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.."
  );
  dotenv({ path: monorepoRoot });

  console.log("ENV example:", {
    ANALYTICS_SQL_DB_NAME: process.env.ANALYTICS_SQL_DB_NAME,
    TOKEN_GENERATION_READ_MODEL_DB_PORT:
      process.env.TOKEN_GENERATION_READ_MODEL_DB_PORT,
    TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM:
      process.env.TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM,
    TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION:
      process.env.TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION,
    tokenGenerationReadModelDbPort: process.env.tokenGenerationReadModelDbPort,
    tokenGenerationReadModelTableNamePlatform:
      process.env.tokenGenerationReadModelTableNamePlatform,
    tokenGenerationReadModelTableNameTokenGeneration:
      process.env.tokenGenerationReadModelTableNameTokenGeneration,
  });
  return async function ({
    provide,
  }: TestProject): Promise<() => Promise<void>> {
    // const provideConfig = <K extends keyof ProvidedContext>(
    //   label: K,
    //   parser: z.SafeParseReturnType<any, ProvidedContext[K]>
    // ) => {
    //   if (parser.success) {
    //     provide(label, parser.data); // 👈 cast esplicito
    //     console.log(`✅ Provided ${label}`);
    //   } else {
    //     console.warn(`⚠️ Failed to provide ${label}`);
    //   }
    // };

    const provideConfig = <K extends keyof ProvidedContext>(
      label: K,
      parser: z.SafeParseReturnType<any, ProvidedContext[K]>
    ) => {
      if (parser.success) {
        provide(label, parser.data);
        console.log(`✅ Provided ${label}`);
      } else {
        console.warn(`⚠️ Failed to provide ${label}`);
        console.warn(parser.error.format()); // <<< stampa dettagli errori di parsing
      }
    };

    provideConfig("eventStoreConfig", EventStoreConfig.safeParse(process.env));
    provideConfig(
      "readModelSQLConfig",
      ReadModelSQLDbConfig.safeParse(process.env)
    );
    provideConfig(
      "analyticsSQLDbConfig",
      AnalyticsSQLDbConfig.safeParse(process.env)
    );
    provideConfig("readModelConfig", ReadModelDbConfig.safeParse(process.env));
    provideConfig(
      "redisRateLimiterConfig",
      RedisRateLimiterConfig.safeParse(process.env)
    );
    provideConfig("sesEmailManagerConfig", AWSSesConfig.safeParse(process.env));
    provideConfig(
      "emailManagerConfig",
      PecEmailManagerConfigTest.safeParse(process.env)
    );

    const tokenGenParsed = EnhancedTokenGenerationReadModelDbConfig.safeParse(
      process.env
    );
    if (tokenGenParsed.success) {
      provide("tokenGenerationReadModelConfig", tokenGenParsed.data);
      console.log("✅ Provided tokenGenerationReadModelConfig");
    } else {
      console.warn("⚠️ Failed to provide tokenGenerationReadModelConfig");
    }

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
      // No cleanup logic necessary: containers are external
    };
  };
}
