/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getMockAttribute } from "pagopa-interop-commons-test";
import { Attribute } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { aggregateAttribute } from "pagopa-interop-readmodel";
import {
  attributeWriterService,
  readModelDB,
  retrieveAttributeSQLById,
} from "./utils.js";

describe("Attribute queries", () => {
  describe("should insert or update an attribute in the db", () => {
    it("should add a complete (*all* fields) attribute", async () => {
      const attribute: Attribute = {
        ...getMockAttribute(),
        code: "test code",
        origin: "test origin",
      };

      await attributeWriterService.upsertAttribute(attribute, 1);

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

      await attributeWriterService.upsertAttribute(attribute, 1);

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
      await attributeWriterService.upsertAttribute(attribute, 1);
      expect(
        await retrieveAttributeSQLById(attribute.id, readModelDB)
      ).toBeDefined();

      const updatedAttribute: Attribute = {
        ...attribute,
        code: "test code updated",
        origin: "test origin updated",
      };
      await attributeWriterService.upsertAttribute(updatedAttribute, 2);

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

  describe("should delete an attribute by id from the db", () => {
    it("delete one attribute", async () => {
      const attribute1: Attribute = {
        ...getMockAttribute(),
        code: "test code 1",
        origin: "test origin 1",
      };
      await attributeWriterService.upsertAttribute(attribute1, 1);
      expect(
        await retrieveAttributeSQLById(attribute1.id, readModelDB)
      ).toBeDefined();

      const attribute2: Attribute = {
        ...getMockAttribute(),
        code: "test code 2",
        origin: "test origin 2",
      };
      await attributeWriterService.upsertAttribute(attribute2, 1);
      expect(
        await retrieveAttributeSQLById(attribute2.id, readModelDB)
      ).toBeDefined();

      await attributeWriterService.deleteAttributeById(attribute1.id, 2);

      expect(
        await retrieveAttributeSQLById(attribute1.id, readModelDB)
      ).toBeUndefined();
      expect(
        await retrieveAttributeSQLById(attribute2.id, readModelDB)
      ).toBeDefined();
    });
  });
});
