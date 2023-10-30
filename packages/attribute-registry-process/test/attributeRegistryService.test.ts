import { describe, expect, it } from "vitest";
import { generateMock } from "@anatine/zod-mock";

import {
  AttributeKind,
  AttributeTmp,
  attributeDuplicate,
} from "pagopa-interop-models";

import {
  createDeclaredAttributeLogic,
  createVerifiedAttributeLogic,
} from "../src/services/attributeRegistryService.js";
import * as api from "../src/model/generated/api.js";
import {
  toAttributeKindV1,
  toAttributeV1,
} from "../src/model/domain/toEvent.js";

const mockAttribute: AttributeTmp = generateMock(AttributeTmp);
const mockAttributeSeed = generateMock(api.schemas.AttributeSeed);
describe("AttributeResistryService", () => {
  describe("create a declared attribute", () => {
    it("creates the attribute", async () => {
      const attribute = {
        ...mockAttribute,
        kind: AttributeKind.Enum.Declared,
      };

      const event = createDeclaredAttributeLogic({
        attributes: { results: [], totalCount: 0 },
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
          attributes: { results: [mockAttribute], totalCount: 1 },
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
        attributes: { results: [], totalCount: 0 },
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
          attributes: { results: [mockAttribute], totalCount: 1 },
          apiVerifiedAttributeSeed: mockAttributeSeed,
        })
      ).toThrowError(attributeDuplicate(mockAttributeSeed.name));
    });
  });
});
