import { describe, expect, it } from "vitest";
import { generateMock } from "@anatine/zod-mock";

import { AttributeKind, Attribute, WithMetadata } from "pagopa-interop-models";

import {
  createDeclaredAttributeLogic,
  createVerifiedAttributeLogic,
} from "../src/services/attributeRegistryService.js";
import * as api from "../src/model/generated/api.js";
import {
  toAttributeKindV1,
  toAttributeV1,
} from "../src/model/domain/toEvent.js";
import { attributeDuplicate } from "../src/model/domain/errors.js";

const mockAttribute: Attribute = generateMock(Attribute);
const addMetadata = (attribute: Attribute): WithMetadata<Attribute> => ({
  data: attribute,
  metadata: { version: 0 },
});

const mockAttributeSeed = generateMock(api.schemas.AttributeSeed);
describe("AttributeResistryService", () => {
  describe("create a declared attribute", () => {
    it("creates the attribute", async () => {
      const attribute = {
        ...mockAttribute,
        kind: AttributeKind.Enum.Declared,
      };

      const event = createDeclaredAttributeLogic({
        attribute: undefined,
        apiDeclaredAttributeSeed: mockAttributeSeed,
      });
      expect(event.event.type).toBe("AttributeAdded");
      expect(event.event.data).toMatchObject({
        attribute: {
          ...toAttributeV1(attribute),
          id: event.streamId,
          name: mockAttributeSeed.name,
          description: mockAttributeSeed.description,
          kind: toAttributeKindV1(AttributeKind.Enum.Declared),
          creationTime: (
            event.event.data as unknown as { attribute: { creationTime: Date } }
          ).attribute.creationTime,
          code: undefined,
          origin: undefined,
        },
      });
    });
    it("returns an error if the attributes list is not empty", async () => {
      expect(() =>
        createDeclaredAttributeLogic({
          attribute: addMetadata(mockAttribute),
          apiDeclaredAttributeSeed: mockAttributeSeed,
        })
      ).toThrowError(attributeDuplicate(mockAttributeSeed.name));
    });
  });
  describe("create a verified attribute", () => {
    it("creates the attribute", async () => {
      const attribute = {
        ...mockAttribute,
        kind: AttributeKind.Enum.Verified,
      };

      const event = createVerifiedAttributeLogic({
        attribute: undefined,
        apiVerifiedAttributeSeed: mockAttributeSeed,
      });
      expect(event.event.type).toBe("AttributeAdded");
      expect(event.event.data).toMatchObject({
        attribute: {
          ...toAttributeV1(attribute),
          id: event.streamId,
          name: mockAttributeSeed.name,
          description: mockAttributeSeed.description,
          kind: toAttributeKindV1(AttributeKind.Enum.Verified),
          creationTime: (
            event.event.data as unknown as { attribute: { creationTime: Date } }
          ).attribute.creationTime,
          code: undefined,
          origin: undefined,
        },
      });
    });
    it("returns an error if the attributes list is not empty", async () => {
      expect(() =>
        createVerifiedAttributeLogic({
          attribute: addMetadata(mockAttribute),
          apiVerifiedAttributeSeed: mockAttributeSeed,
        })
      ).toThrowError(attributeDuplicate(mockAttributeSeed.name));
    });
  });
});
