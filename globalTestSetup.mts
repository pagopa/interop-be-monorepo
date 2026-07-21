import type { TestProject } from "vitest/node";
import "vitest";
import {
  setupDynamoDBTestContainer,
  createTestInfraNetwork,
} from "pagopa-interop-commons-test";

export default async function setup(project: TestProject) {
  const network = await createTestInfraNetwork();

  const [{ container: dynamoDBContainer, endpoint: dynamoDBEndpoint }] =
    await Promise.all([setupDynamoDBTestContainer(network)]);

  project.provide("DYNAMODB_CONNECTION_STRING", dynamoDBEndpoint);

  return async function teardown() {
    await Promise.all([dynamoDBContainer.stop({ removeVolumes: true })]);
    await network.stop();
  };
}
