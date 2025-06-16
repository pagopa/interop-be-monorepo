/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable complexity */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable no-console */
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
  S3Client,
  CreateBucketCommand,
  ListBucketsCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
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
  const loggerConfigResult = LoggerConfig.safeParse({
    logLevel: process.env.LOG_LEVEL || "info",
  });
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

      // Setup MinIO (S3)

      const timeoutMiddleware =
        (timeoutMs: number) => (next: any) => async (args: any) => {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error(`Request timed out after ${timeoutMs}ms`)),
              timeoutMs
            );
          });
          return Promise.race([next(args), timeoutPromise]);
        };

      console.log("S3_BUCKET:", process.env.S3_BUCKET);
      console.log("S3_ACCESS_KEY_ID:", process.env.S3_ACCESS_KEY_ID);
      console.log("S3_SECRET_ACCESS_KEY:", process.env.S3_SECRET_ACCESS_KEY);
      console.log("LOG_LEVEL:", process.env.LOG_LEVEL);

      if (
        fileManagerConfigResult.success &&
        s3ConfigResult.success &&
        loggerConfigResult.success
      ) {
        console.log("MinIO config valid, proceeding with setup...");
        const originalFileManagerData = fileManagerConfigResult.data;
        const originalS3Data = s3ConfigResult.data;
        const loggerData = loggerConfigResult.data;

        const minioAccessKeyId = "testawskey";
        const minioSecretAccessKey = "testawssecret";

        // Imposta credenziali S3
        process.env.AWS_ACCESS_KEY_ID = minioAccessKeyId;
        process.env.AWS_SECRET_ACCESS_KEY = minioSecretAccessKey;

        const minioContainerParams = {
          ...originalFileManagerData,
          s3Bucket: originalS3Data.s3Bucket,
          s3AccessKeyId: minioAccessKeyId,
          s3SecretAccessKey: minioSecretAccessKey,
        };

        console.log("Starting MinIO container...");
        try {
          startedMinioContainer = await minioContainer(minioContainerParams)
            .withNetwork(network)
            .withNetworkAliases("minio")
            .withReuse()
            .withStartupTimeout(120000) // Timeout di 120 secondi
            .start();
          console.log(
            "MinIO container started:",
            startedMinioContainer.getId()
          );
        } catch (error) {
          console.error("Failed to start MinIO container:", error);
          throw error;
        }

        // Verifica stato container
        console.log("Checking MinIO container status...");
        // There is no getContainerInfo() method; if .start() did not throw, we assume it's running.
        // Optionally, log the container ID for traceability.
        if (!startedMinioContainer.getId()) {
          console.error(
            "MinIO container did not return a valid ID, may not be running."
          );
          throw new Error("MinIO container failed to start");
        }
        console.log(
          "MinIO container is running with ID:",
          startedMinioContainer.getId()
        );

        const s3MappedPort =
          startedMinioContainer.getMappedPort(TEST_MINIO_PORT);
        const s3Host = "http://127.0.0.1";
        const s3FullEndpointUrl = `${s3Host}:${s3MappedPort}`;

        // Test connettività con endpoint di salute
        console.log(
          `Testing MinIO connectivity: ${s3FullEndpointUrl}/minio/health/live`
        );
        try {
          const response = await fetch(
            `${s3FullEndpointUrl}/minio/health/live`,
            {
              method: "GET",
              signal: AbortSignal.timeout(5000),
            }
          );
          console.log(`MinIO health check status: ${response.status}`);
          if (!response.ok) {
            console.warn(
              `MinIO health check returned non-OK status: ${response.status}`
            );
          }
        } catch (error) {
          console.error("Failed to connect to MinIO health check:", error);
          throw error;
        }

        // Configura client S3
        console.log("Configuring S3 client...");
        const s3Client = new S3Client({
          endpoint: s3FullEndpointUrl,
          region: "eu-south-1",
          credentials: {
            accessKeyId: minioAccessKeyId,
            secretAccessKey: minioSecretAccessKey,
          },
          forcePathStyle: true,
        });

        s3Client.middlewareStack.add(timeoutMiddleware(15000), {
          step: "initialize",
          priority: "high",
        });

        // Crea bucket
        const bucketName = originalS3Data.s3Bucket;
        console.log(`Creating bucket: ${bucketName}`);
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
          console.log(`Bucket ${bucketName} created successfully`);
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "name" in error &&
            (error as { name?: unknown }).name === "BucketAlreadyOwnedByYou"
          ) {
            console.log(`Bucket ${bucketName} already exists`);
          } else {
            console.error(`Failed to create bucket ${bucketName}:`, error);
            throw error;
          }
        }

        // Test connessione bucket
        console.log(`Testing MinIO bucket access: ${bucketName}`);
        try {
          const { Buckets } = await s3Client.send(new ListBucketsCommand({}));
          console.log(
            `Available buckets: ${(Buckets ?? [])
              .map((b) => b.Name)
              .join(", ")}`
          );
        } catch (error) {
          console.error("Failed to list buckets:", error);
          throw error;
        }

        // Test accessibilità bucket
        console.log(`Testing MinIO bucket existence: ${bucketName}`);
        try {
          await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
          console.log(`Bucket ${bucketName} exists and is accessible`);
        } catch (error) {
          console.error(`Failed to access bucket ${bucketName}:`, error);
          throw error;
        }

        // Configura fileManager
        console.log("Configuring fileManager...");
        const minioConfigToProvide: EnhancedFileManagerConfig & LoggerConfig = {
          s3CustomServer: true,
          s3ServerHost: s3Host,
          s3ServerPort: s3MappedPort,
          s3Bucket: bucketName,
          s3AccessKeyId: minioAccessKeyId,
          s3SecretAccessKey: minioSecretAccessKey,
          logLevel: loggerData.logLevel,
        };

        console.log(
          "minioConfigToProvide:",
          JSON.stringify(minioConfigToProvide, null, 2)
        );
        provide("fileManagerConfig", minioConfigToProvide);

        // Log MinIO (opzionale, con timeout)
        console.log("Retrieving MinIO logs...");
        try {
          const logTimeout = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Timeout retrieving MinIO logs")),
              5000
            );
          });
          const logPromise = startedMinioContainer
            .logs()
            .then(async (logStream) => {
              let logs = "";
              for await (const chunk of logStream) {
                logs += chunk.toString();
              }
              return logs;
            });
          const combinedLogs = await Promise.race([logPromise, logTimeout]);
          console.log("MinIO combined logs:", combinedLogs);
        } catch (error) {
          console.error(
            "Failed to retrieve MinIO logs:",
            typeof error === "object" && error !== null && "message" in error
              ? (error as { message?: unknown }).message
              : String(error)
          );
          // Non lanciare l'errore per non interrompere il setup
        }
      } else {
        console.error("Skipping MinIO setup due to invalid config");
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
