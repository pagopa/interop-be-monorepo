/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getMockAttribute } from "pagopa-interop-commons-test";
import { Attribute, AttributeId, generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { aggregateAttribute } from "../src/attribute/aggregators.js";
import { readModelDB } from "./utils.js";
import {
  attributeReadModelService,
  retrieveAttributeSQLById,
} from "./attributeUtils.js";

describe("Attribute queries", () => {
  describe("should insert or update an attribute in the db", () => {
    it("should add a complete (*all* fields) attribute", async () => {
      const attribute: Attribute = {
        ...getMockAttribute(),
        code: "test code",
        origin: "test origin",
      };

      await attributeReadModelService.upsertAttribute(attribute, 1);

      const retrievedAttributeSQL = await retrieveAttributeSQLById(
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

      const retrievedAttributeSQL = await retrieveAttributeSQLById(
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
        await retrieveAttributeSQLById(attribute.id, readModelDB)
      ).toBeDefined();

      const updatedAttribute: Attribute = {
        ...attribute,
        code: "test code updated",
        origin: "test origin updated",
      };
      await attributeReadModelService.upsertAttribute(updatedAttribute, 2);

      const retrievedAttributeSQL = await retrieveAttributeSQLById(
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

  describe("should get an attribute by id from the db", () => {
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

  describe("should delete an attribute by id from the db", () => {
    it("delete one attribute", async () => {
      const attribute1: Attribute = {
        ...getMockAttribute(),
        code: "test code 1",
        origin: "test origin 1",
      };
      await attributeReadModelService.upsertAttribute(attribute1, 1);
      expect(
        await retrieveAttributeSQLById(attribute1.id, readModelDB)
      ).toBeDefined();

      const attribute2: Attribute = {
        ...getMockAttribute(),
        code: "test code 2",
        origin: "test origin 2",
      };
      await attributeReadModelService.upsertAttribute(attribute2, 1);
      expect(
        await retrieveAttributeSQLById(attribute2.id, readModelDB)
      ).toBeDefined();

      await attributeReadModelService.deleteAttributeById(attribute1.id, 2);

      expect(
        await retrieveAttributeSQLById(attribute1.id, readModelDB)
      ).toBeUndefined();
      expect(
        await retrieveAttributeSQLById(attribute2.id, readModelDB)
      ).toBeDefined();
    });
  });
});
