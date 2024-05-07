/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import {
  TEST_MONGO_DB_PORT,
  getMockAgreement,
  mongoDBContainer,
} from "pagopa-interop-commons-test";
import { beforeAll, describe, expect, it } from "vitest";
import { StartedTestContainer } from "testcontainers";
import { config } from "../src/utilities/config.js";

describe("EService Descripors Archiver", async () => {
  let startedMongodbContainer: StartedTestContainer;

  beforeAll(async () => {
    startedMongodbContainer = await mongoDBContainer(config).start();

    config.readModelDbPort =
      startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
  });
  it("Should call archive Descriptor when all Agreements are Archived and the Descriptor is deprecated", async () => {
    const agreement = getMockAgreement();

    expect(agreement).toBeDefined(); // TODO: Implement test
  });
});
