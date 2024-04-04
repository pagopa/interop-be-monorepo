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
  getMockAttribute,
  mongoDBContainer,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeAddedV1,
  AttributeDeletedV1,
  AttributeEventEnvelope,
  attributeKind,
  toAttributeV1,
  toReadModelAttribute,
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

  describe("Events V1", () => {
    it("AttributeAdded - certified", async () => {
      const certifiedAttribute: Attribute = {
        ...getMockAttribute(),
        kind: attributeKind.certified,
        code: "123456",
        origin: "certifier-id",
      };
      const payload: AttributeAddedV1 = {
        attribute: toAttributeV1(certifiedAttribute),
      };
      const message: AttributeEventEnvelope = {
        sequence_num: 1,
        stream_id: certifiedAttribute.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, attributes);

      const retrievedAttribute = await attributes.findOne({
        "data.id": certifiedAttribute.id,
      });

      expect(retrievedAttribute).toMatchObject({
        data: toReadModelAttribute(certifiedAttribute),
        metadata: { version: 1 },
      });
    });

    it("AttributeAdded - declared", async () => {
      const declaredAttribute: Attribute = {
        ...getMockAttribute(),
        kind: attributeKind.declared,
      };
      const payload: AttributeAddedV1 = {
        attribute: toAttributeV1(declaredAttribute),
      };
      const message: AttributeEventEnvelope = {
        sequence_num: 1,
        stream_id: declaredAttribute.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: payload,
      };
      await handleMessage(message, attributes);

      const retrievedAttribute = await attributes.findOne({
        "data.id": declaredAttribute.id,
      });

      expect(retrievedAttribute?.data).toEqual(
        toReadModelAttribute(declaredAttribute)
      );
      expect(retrievedAttribute?.metadata).toEqual({ version: 1 });
    });

    it("AttributeAdded - verified", async () => {
      const verifiedAttribute: Attribute = {
        ...getMockAttribute(),
        kind: attributeKind.verified,
      };
      const payload: AttributeAddedV1 = {
        attribute: toAttributeV1(verifiedAttribute),
      };
      const message: AttributeEventEnvelope = {
        sequence_num: 1,
        stream_id: verifiedAttribute.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: payload,
      };
      await handleMessage(message, attributes);

      const retrievedAttribute = await attributes.findOne({
        "data.id": verifiedAttribute.id,
      });

      expect(retrievedAttribute?.data).toEqual(
        toReadModelAttribute(verifiedAttribute)
      );
      expect(retrievedAttribute?.metadata).toEqual({ version: 1 });
    });

    it("AttributeDeleted", async () => {
      const certifiedAttribute: Attribute = {
        ...getMockAttribute(),
        kind: attributeKind.verified,
      };
      await writeInReadmodel(
        toReadModelAttribute(certifiedAttribute),
        attributes
      );
      const payload: AttributeDeletedV1 = {
        id: certifiedAttribute.id,
      };
      const message: AttributeEventEnvelope = {
        sequence_num: 1,
        stream_id: certifiedAttribute.id,
        version: 1,
        type: "AttributeDeleted",
        event_version: 1,
        data: payload,
      };
      await handleMessage(message, attributes);

      const retrievedAttribute = await attributes.findOne({
        "data.id": certifiedAttribute.id,
      });

      expect(retrievedAttribute).toBeNull();
    });
  });
});
