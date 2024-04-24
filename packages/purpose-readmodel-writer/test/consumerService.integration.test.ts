/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { afterEach, afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PurposeCollection,
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import { mongoDBContainer } from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";

describe("Integration tests", async () => {
  let purposes: PurposeCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();

  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    purposes = readModelRepository.purposes;
  });

  afterEach(async () => {
    await purposes.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  describe("Events V1", () => {
    it("PurposeAdded", () => {
      expect(1).toBe(1);
    });
  });

  describe("Events V2", () => {
    it("PurposeAdded", () => {
      expect(2).toBe(2);
    });
  });
});
