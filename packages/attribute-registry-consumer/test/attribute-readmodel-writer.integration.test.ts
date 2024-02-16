/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AttributeCollection,
  ReadModelRepository,
  consumerConfig,
} from "pagopa-interop-commons";
import {
  AttributeAddedV1,
  AttributeKindV1,
  generateId,
} from "pagopa-interop-models";
import { GenericContainer } from "testcontainers";
import { EventEnvelope } from "../src/model/models.js";
import { handleMessage } from "../src/attributeRegistryConsumerService.js";

describe("database test", async () => {
  let attributes: AttributeCollection;

  const config = consumerConfig();
  beforeAll(async () => {
    const mongodbContainer = await new GenericContainer("mongo:6.0.7")
      .withEnvironment({
        MONGO_INITDB_DATABASE: config.readModelDbName,
        MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
        MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
      })
      .withExposedPorts(27017)
      .start();

    config.readModelDbPort = mongodbContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    attributes = readModelRepository.attributes;
  });

  afterEach(async () => {
    await attributes.deleteMany({});
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
      const message: EventEnvelope = {
        sequence_num: 1,
        stream_id: id,
        version: 1,
        type: "AttributeAdded",
        data: newAttribute,
      };
      await handleMessage(message, attributes);

      const attribute = await attributes.findOne({
        "data.id": id.toString,
      });

      expect(attribute?.data?.id).toBe(newAttribute.attribute?.id);
      expect(attribute?.data.name).toBe(newAttribute.attribute?.name);
      expect(attribute?.data.description).toBe(
        newAttribute.attribute?.description
      );
    });
  });
});
