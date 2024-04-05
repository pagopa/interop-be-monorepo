/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, afterAll, beforeAll, describe } from "vitest";
import {
  ReadModelRepository,
  TenantCollection,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import { mongoDBContainer } from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";

describe("database test", async () => {
  let tenants: TenantCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();

  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    tenants = readModelRepository.tenants;
  });

  afterEach(async () => {
    await tenants.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  describe("Events V1", async () => {});
});
