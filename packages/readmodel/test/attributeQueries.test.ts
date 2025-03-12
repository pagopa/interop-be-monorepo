/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getMockAttribute } from "pagopa-interop-commons-test";
import { Attribute, AttributeId, generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { aggregateAttribute } from "../src/attribute/aggregators.js";
import { attributeReadModelService, readModelDB } from "./utils.js";
import { retrieveAttributeSQL } from "./attributeTestReadModelService.js";

describe("Attribute queries", () => {
  describe("upsertAttribute", () => {
    it("should add a complete (*all* fields) attribute", async () => {
      const attribute: Attribute = {
        ...getMockAttribute(),
        code: "test code",
        origin: "test origin",
      };

      await attributeReadModelService.upsertAttribute(attribute, 1);

      const retrievedAttributeSQL = await retrieveAttributeSQL(
        attribute.id,
        readModelDB
      );
      expect(retrievedAttributeSQL).toBeDefined();

      const retrievedAttribute = aggregateAttribute(retrievedAttributeSQL!);
      expect(retrievedAttribute).toStrictEqual({
        data: attribute,
        metadata: { version: 1 },
      });
    });

    it("should add an incomplete (*only* mandatory fields) attribute", async () => {
      const attribute: Attribute = {
        ...getMockAttribute(),
      };

      await attributeReadModelService.upsertAttribute(attribute, 1);

      const retrievedAttributeSQL = await retrieveAttributeSQL(
        attribute.id,
        readModelDB
      );
      expect(retrievedAttributeSQL).toBeDefined();

      const retrievedAttribute = aggregateAttribute(retrievedAttributeSQL!);
      expect(retrievedAttribute).toStrictEqual({
        data: attribute,
        metadata: { version: 1 },
      });
    });

    it("should update an attribute", async () => {
      const attribute: Attribute = {
        ...getMockAttribute(),
        code: "test code",
        origin: "test origin",
      };
      await attributeReadModelService.upsertAttribute(attribute, 1);
      expect(
        await retrieveAttributeSQL(attribute.id, readModelDB)
      ).toBeDefined();

      const updatedAttribute: Attribute = {
        ...attribute,
        code: "test code updated",
        origin: "test origin updated",
      };
      await attributeReadModelService.upsertAttribute(updatedAttribute, 2);

      const retrievedAttributeSQL = await retrieveAttributeSQL(
        attribute.id,
        readModelDB
      );
      expect(retrievedAttributeSQL).toBeDefined();

      const retrievedAttribute = aggregateAttribute(retrievedAttributeSQL!);
      expect(retrievedAttribute).toStrictEqual({
        data: updatedAttribute,
        metadata: { version: 2 },
      });
    });
  });

  describe("getAttributeById", () => {
    it("attribute found", async () => {
      const attribute: Attribute = {
        ...getMockAttribute(),
        code: "test code",
        origin: "test origin",
      };

      await attributeReadModelService.upsertAttribute(attribute, 1);

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

  describe("getAllAttributes", () => {
    it("get all attributes", async () => {
      const attribute1: Attribute = {
        ...getMockAttribute(),
      };
      await attributeReadModelService.upsertAttribute(attribute1, 1);

      const attribute2: Attribute = {
        ...getMockAttribute(),
      };
      await attributeReadModelService.upsertAttribute(attribute2, 1);

      const retrievedAttributes =
        await attributeReadModelService.getAllAttributes();
      expect(retrievedAttributes).toStrictEqual(
        expect.arrayContaining([
          { data: attribute1, metadata: { version: 1 } },
          { data: attribute2, metadata: { version: 1 } },
        ])
      );
    });

    it("attributes NOT found", async () => {
      const retrievedAttributes =
        await attributeReadModelService.getAllAttributes();
      expect(retrievedAttributes).toHaveLength(0);
    });
  });

  describe("deleteAttributeById", () => {
    it("delete one attribute", async () => {
      const attribute: Attribute = {
        ...getMockAttribute(),
        code: "test code",
        origin: "test origin",
      };

      await attributeReadModelService.upsertAttribute(attribute, 1);
      expect(
        await retrieveAttributeSQL(attribute.id, readModelDB)
      ).toBeDefined();

      await attributeReadModelService.deleteAttributeById(attribute.id, 2);
      expect(
        await retrieveAttributeSQL(attribute.id, readModelDB)
      ).toBeUndefined();
    });
  });
});
