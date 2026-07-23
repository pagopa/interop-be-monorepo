import type { TestProject } from "vitest/node";
import "vitest";
import {
  setupDynamoDBTestContainer,
  createTestInfraNetwork,
} from "pagopa-interop-commons-test";
import {
  setupPostgresTestContainer,
  setupPostgresTemplate,
} from "./packages/commons-test/src/testcontainers/postgres.js";
import { setupMinioTestContainer } from "./packages/commons-test/src/testcontainers/minio.js";
import { READMODEL_DB_TEMPLATE_NAME } from "./packages/commons-test/src/dbs/readmodel.js";
import { EVENTSTORE_DB_TEMPLATE_NAME } from "./packages/commons-test/src/dbs/eventstore.js";
import { TENANT_KIND_HISTORY_DB_TEMPLATE_NAME } from "./packages/commons-test/src/dbs/tenantKindHistory.js";

export default async function setup(project: TestProject) {
  const network = await createTestInfraNetwork();

  const [
    {
      container: postgresContainer,
      connectionString: postgresConnectionString,
    },
    { container: dynamoDBContainer, endpoint: dynamoDBEndpoint },
    { container: minioContainer, connectionString: minioConnectionString },
  ] = await Promise.all([
    setupPostgresTestContainer(network),
    setupDynamoDBTestContainer(network),
    setupMinioTestContainer(),
  ]);

  await Promise.all([
    setupPostgresTemplate({
      connectionString: postgresConnectionString,
      sqlDir: "docker/readmodel-db",
      template: READMODEL_DB_TEMPLATE_NAME,
    }),
    setupPostgresTemplate({
      connectionString: postgresConnectionString,
      sqlDir: "docker/event-store-db",
      template: EVENTSTORE_DB_TEMPLATE_NAME,
    }),
    setupPostgresTemplate({
      connectionString: postgresConnectionString,
      sqlDir: "docker/tenant-kind-history-db",
      template: TENANT_KIND_HISTORY_DB_TEMPLATE_NAME,
    }),
  ]);

  project.provide("POSTGRES_CONNECTION_STRING", postgresConnectionString);
  project.provide("DYNAMODB_CONNECTION_STRING", dynamoDBEndpoint);
  project.provide("MINIO_CONNECTION_STRING", minioConnectionString);

  return async function teardown() {
    await Promise.all([
      postgresContainer.stop({ removeVolumes: true }),
      dynamoDBContainer.stop({ removeVolumes: true }),
      minioContainer.stop({ removeVolumes: true }),
    ]);
    await network.stop();
  };
}
