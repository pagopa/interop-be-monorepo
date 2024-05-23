/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { afterEach, afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ClientCollection,
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import { mongoDBContainer } from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";

describe("Integration tests", async () => {
  let clients: ClientCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();

  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    clients = readModelRepository.clients;
  });

  afterEach(async () => {
    await clients.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  describe("Events V1", () => {
    it(() => {
      expect(1).toBe(1);
    });
  });
  describe("Events V2", () => {
    it(() => {
      expect(2).toBe(2);
    });
  });
});
