import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer } from "testcontainers";
import {
  EventStoreConfig,
  ReadModelDbConfig,
} from "../../commons/src/index.js";

export const TEST_MONGO_DB_PORT = 27017;
export const TEST_MONGO_DB_IMAGE = "mongo:4.0.0";

export const TEST_POSTGRES_DB_PORT = 5432;
export const TEST_POSTGRES_DB_IMAGE = "postgres:14";

export const TEST_MINIO_PORT = 9000;
export const TEST_MINIO_IMAGE =
  "quay.io/minio/minio:RELEASE.2024-02-06T21-36-22Z";

/**
 * Starts a MongoDB container for testing purposes.
 *
 * @param config - The configuration for the MongoDB container.
 * @returns A promise that resolves to the started test container.
 */
export const mongoDBContainer = (config: ReadModelDbConfig): GenericContainer =>
  new GenericContainer(TEST_MONGO_DB_IMAGE)
    .withEnvironment({
      MONGO_INITDB_DATABASE: config.readModelDbName,
      MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
      MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
    })
    .withExposedPorts(TEST_MONGO_DB_PORT);

/**
 * Starts a PostgreSQL container for testing purposes.
 *
 * @param config - The configuration for the PostgreSQL container.
 * @returns A promise that resolves to the started test container.
 */
export const postgreSQLContainer = (
  config: EventStoreConfig
): GenericContainer =>
  new PostgreSqlContainer(TEST_POSTGRES_DB_IMAGE)
    .withUsername(config.eventStoreDbUsername)
    .withPassword(config.eventStoreDbPassword)
    .withDatabase(config.eventStoreDbName)
    .withCopyFilesToContainer([
      {
        source: "../../docker/event-store-init.sql",
        target: "/docker-entrypoint-initdb.d/01-init.sql",
      },
    ])
    .withExposedPorts(TEST_POSTGRES_DB_PORT);

/**
 * Starts a MinIO container for testing purposes.
 *
 * @param config - The configuration for the MinIO container.
 * @returns A promise that resolves to the started test container.
 */

export const minioContainer = (config: {
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3Region: string;
  s3Bucket: string;
}): GenericContainer =>
  new GenericContainer(TEST_MINIO_IMAGE)
    .withEnvironment({
      MINIO_ROOT_USER: config.s3AccessKeyId,
      MINIO_ROOT_PASSWORD: config.s3SecretAccessKey,
      MINIO_SITE_REGION: config.s3Region,
    })
    .withEntrypoint(["sh", "-c"])
    .withCommand([
      `mkdir -p /data/${config.s3Bucket} && /usr/bin/minio server /data`,
    ])
    .withExposedPorts(TEST_MINIO_PORT);
