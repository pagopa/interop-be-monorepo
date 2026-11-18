import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeAddedV1,
  AttributeEventEnvelopeV1,
  AttributeEventEnvelopeV2,
  attributeKind,
  toAttributeV1,
  toRegistryAttributeV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { handleMessage } from "../src/attributeRegistryConsumerService.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import { attributeReadModelService, attributeWriterService } from "./utils.js";

describe("database test", async () => {
  describe("Events V1", () => {
    it("AttributeAdded - certified", async () => {
      const certifiedAttribute: Attribute = {
        ...getMockAttribute(attributeKind.certified),
        origin: "certifier-id",
      };
      const payload: AttributeAddedV1 = {
        attribute: toAttributeV1(certifiedAttribute),
      };
      const message: AttributeEventEnvelopeV1 = {
        sequence_num: 1,
        stream_id: certifiedAttribute.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, attributeWriterService);

      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(certifiedAttribute.id);
      expect(retrievedAttribute).toStrictEqual({
        data: certifiedAttribute,
        metadata: { version: 1 },
      });
    });

    it("AttributeAdded - declared", async () => {
      const declaredAttribute = getMockAttribute(attributeKind.declared);
      const payload: AttributeAddedV1 = {
        attribute: toAttributeV1(declaredAttribute),
      };
      const message: AttributeEventEnvelopeV1 = {
        sequence_num: 1,
        stream_id: declaredAttribute.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, attributeWriterService);

      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(declaredAttribute.id);

      expect(retrievedAttribute?.data).toStrictEqual(declaredAttribute);
      expect(retrievedAttribute?.metadata).toStrictEqual({ version: 1 });
    });

    it("AttributeAdded - verified", async () => {
      const verifiedAttribute = getMockAttribute(attributeKind.verified);
      const payload: AttributeAddedV1 = {
        attribute: toAttributeV1(verifiedAttribute),
      };
      const message: AttributeEventEnvelopeV1 = {
        sequence_num: 1,
        stream_id: verifiedAttribute.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, attributeWriterService);

      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(verifiedAttribute.id);

      expect(retrievedAttribute?.data).toStrictEqual(verifiedAttribute);
      expect(retrievedAttribute?.metadata).toStrictEqual({ version: 1 });
    });
  });

  describe("Events V2", () => {
    it("AttributeSubunitPropagationUpdated", async () => {
      const certifiedAttribute: Attribute = {
        ...getMockAttribute(attributeKind.certified),
        origin: "certifier-id",
      };
      await attributeWriterService.upsertAttribute(certifiedAttribute, 1);

      const updatedAttribute: Attribute = {
        ...certifiedAttribute,
        subunitPropagationEnabled: true,
      };
      const message: AttributeEventEnvelopeV2 = {
        sequence_num: 2,
        stream_id: certifiedAttribute.id,
        version: 2,
        type: "AttributeSubunitPropagationUpdated",
        event_version: 2,
        data: { attribute: toRegistryAttributeV2(updatedAttribute) },
        log_date: new Date(),
      };
      await handleMessageV2(message, attributeWriterService);

      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(certifiedAttribute.id);
      expect(retrievedAttribute).toStrictEqual({
        data: updatedAttribute,
        metadata: { version: 2 },
      });
    });
  });
});
