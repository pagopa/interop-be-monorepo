import { describe, expect, it } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeAddedV1,
  AttributeEventEnvelope,
  attributeKind,
  toAttributeV1,
} from "pagopa-interop-models";
import { handleMessage } from "../src/attributeRegistryConsumerService.js";
import { attributeReadModelService, attributeWriterService } from "./utils.js";

describe("database test", async () => {
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
      await handleMessage(message, attributeWriterService);

      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(certifiedAttribute.id);
      expect(retrievedAttribute).toStrictEqual({
        data: certifiedAttribute,
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
        log_date: new Date(),
      };
      await handleMessage(message, attributeWriterService);

      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(declaredAttribute.id);

      expect(retrievedAttribute?.data).toStrictEqual(declaredAttribute);
      expect(retrievedAttribute?.metadata).toStrictEqual({ version: 1 });
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
        log_date: new Date(),
      };
      await handleMessage(message, attributeWriterService);

      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(verifiedAttribute.id);

      expect(retrievedAttribute?.data).toStrictEqual(verifiedAttribute);
      expect(retrievedAttribute?.metadata).toStrictEqual({ version: 1 });
    });
  });
});
