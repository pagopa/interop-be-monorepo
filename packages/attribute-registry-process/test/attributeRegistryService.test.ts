import { describe, expect, it } from "vitest";
import { generateMock } from "@anatine/zod-mock";

import {
  AttributeKind,
  AttributeTmp,
  attributeDuplicate,
} from "pagopa-interop-models";

import { createDeclaredAttributeLogic } from "../src/services/attributeRegistryService.js";
import * as api from "../src/model/generated/api.js";
import {
  toAttributeKindV1,
  toDeclaredAttributeV1,
} from "../src/model/domain/toEvent.js";

const mockAttribute: AttributeTmp = generateMock(AttributeTmp);
const mockDeclaredAttributeSeed = generateMock(api.schemas.AttributeSeed);
describe("AttributeResistryService", () => {
  describe("create a declared attribute", () => {
    it("creates the attribute", async () => {
      const attribute = {
        ...mockAttribute,
        kind: AttributeKind.Enum.Declared,
      };

      const event = createDeclaredAttributeLogic({
        attributes: { results: [], totalCount: 0 },
        apiDeclaredAttributeSeed: mockDeclaredAttributeSeed,
      });
      expect(event.event.type).toBe("AttributeAdded");
      expect(event.event.data).toMatchObject({
        attribute: {
          ...toDeclaredAttributeV1(attribute),
          id: event.streamId,
          name: mockDeclaredAttributeSeed.name,
          description: mockDeclaredAttributeSeed.description,
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
          apiDeclaredAttributeSeed: mockDeclaredAttributeSeed,
        })
      ).toThrowError(attributeDuplicate(mockDeclaredAttributeSeed.name));
    });
  });
});
