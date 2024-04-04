import { EventStoreConfig, ReadModelDbConfig } from "pagopa-interop-commons";
import { GenericContainer } from "testcontainers";

export const TEST_MONGO_DB_PORT = 27017;
export const TEST_MONGO_DB_IMAGE = "mongo:4";

export const TEST_POSTGRES_DB_PORT = 5432;
export const TEST_POSTGRES_DB_IMAGE = "postgres:14";

export const TEST_MINIO_PORT = 9000;
export const TEST_MINIO_IMAGE =
  "quay.io/minio/minio:RELEASE.2024-02-06T21-36-22Z";

export const TEST_ELASTIC_MQ_IMAGE = "softwaremill/elasticmq-native:latest";
export const TEST_ELASTIC_MQ_PORT = 9324;

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
  new GenericContainer(TEST_POSTGRES_DB_IMAGE)
    .withEnvironment({
      POSTGRES_DB: config.eventStoreDbName,
      POSTGRES_USER: config.eventStoreDbUsername,
      POSTGRES_PASSWORD: config.eventStoreDbPassword,
    })
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
  s3Bucket: string;
}): GenericContainer =>
  new GenericContainer(TEST_MINIO_IMAGE)
    .withEnvironment({
      MINIO_ROOT_USER: "test-aws-key",
      MINIO_ROOT_PASSWORD: "test-aws-secret",
      MINIO_SITE_REGION: "eu-central-1",
    })
    .withEntrypoint(["sh", "-c"])
    .withCommand([
      `mkdir -p /data/${config.s3Bucket} && /usr/bin/minio server /data`,
    ])
    .withExposedPorts(TEST_MINIO_PORT);

export const elasticMQContainer = (): GenericContainer =>
  new GenericContainer(TEST_ELASTIC_MQ_IMAGE)
    .withCopyFilesToContainer([
      {
        source: "elasticmq.local.conf",
        target: "/opt/elasticmq.conf",
      },
    ])
    .withExposedPorts(TEST_ELASTIC_MQ_PORT);
