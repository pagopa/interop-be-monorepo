import { getMockAttribute } from "pagopa-interop-commons-test";
import { Attribute, AttributeId, generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { upsertAttribute } from "../../src/testUtils.js";
import { readModelDB } from "../utils.js";
import { attributeReadModelService } from "./attributeUtils.js";

describe("Attribute queries", () => {
  describe("should get an attribute by id from the db", () => {
    it("attribute found", async () => {
      const attribute: Attribute = {
        ...getMockAttribute(),
        code: "test code",
        origin: "test origin",
      };

      await upsertAttribute(readModelDB, attribute, 1);

      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(attribute.id);

      expect(retrievedAttribute).toStrictEqual({
        data: attribute,
        metadata: { version: 1 },
      });
    });

    it("attribute not found", async () => {
      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(
          generateId<AttributeId>()
        );

      expect(retrievedAttribute).toBeUndefined();
    });
  });
});
