/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AttributeCollection,
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import {
  TEST_MONGO_DB_PORT,
  mongoDBContainer,
} from "pagopa-interop-commons-test";
import {
  AttributeAddedV1,
  AttributeEventEnvelope,
  AttributeKindV1,
  generateId,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import { handleMessage } from "../src/attributeRegistryConsumerService.js";

describe("database test", async () => {
  let attributes: AttributeCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();
  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort =
      startedMongoDBContainer.getMappedPort(TEST_MONGO_DB_PORT);

    const readModelRepository = ReadModelRepository.init(config);
    attributes = readModelRepository.attributes;
  });

  afterEach(async () => {
    await attributes.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  describe("Handle message for attribute creation", () => {
    it("should create an attribute", async () => {
      const id = generateId();
      const newAttribute: AttributeAddedV1 = {
        attribute: {
          id,
          kind: AttributeKindV1.DECLARED,
          name: "name",
          description: "description",
          creationTime: new Date().toString(),
        },
      };
      const message: AttributeEventEnvelope = {
        sequence_num: 1,
        stream_id: id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: newAttribute,
        log_date: new Date(),
      };
      await handleMessage(message, attributes);

      const attribute = await attributes.findOne({
        "data.id": id.toString,
      });

      expect(attribute?.data).toMatchObject({
        id: newAttribute.attribute?.id,
        name: newAttribute.attribute?.name,
        description: newAttribute.attribute?.description,
      });
    });
  });
});
