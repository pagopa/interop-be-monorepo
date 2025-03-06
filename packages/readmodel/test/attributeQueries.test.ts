/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeId,
  generateId,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { AttributeSQL } from "pagopa-interop-readmodel-models";
import {
  attributeReadModelService,
  readModelDB,
  stringToISOString,
} from "./utils.js";
import { retrieveAttributeSQL } from "./attributeTestReadModelService.js";

describe("Attribute queries", () => {
  describe("upsertAttribute", () => {
    it("should add a complete (*all* fields) attribute", async () => {
      const attribute: WithMetadata<Attribute> = {
        data: {
          ...getMockAttribute(),
          code: "test code",
          origin: "test origin",
        },
        metadata: { version: 1 },
      };

      await attributeReadModelService.upsertAttribute(attribute);

      const retrievedAttributeSQL = await retrieveAttributeSQL(
        attribute.data.id,
        readModelDB
      );
      const retrievedAndFormattedAttributeSQL = retrievedAttributeSQL
        ? {
            ...retrievedAttributeSQL,
            creationTime: stringToISOString(retrievedAttributeSQL.creationTime),
          }
        : undefined;

      const expectedAttributeSQL: AttributeSQL = {
        id: attribute.data.id,
        name: attribute.data.name,
        description: attribute.data.description,
        metadataVersion: attribute.metadata.version,
        kind: attribute.data.kind,
        creationTime: attribute.data.creationTime.toISOString(),
        code: attribute.data.code!,
        origin: attribute.data.origin!,
      };

      expect(retrievedAndFormattedAttributeSQL).toMatchObject(
        expectedAttributeSQL
      );
    });

    it("should add an incomplete (*only* mandatory fields) attribute", async () => {
      const attribute: WithMetadata<Attribute> = {
        data: {
          ...getMockAttribute(),
        },
        metadata: { version: 1 },
      };

      await attributeReadModelService.upsertAttribute(attribute);

      const retrievedAttributeSQL = await retrieveAttributeSQL(
        attribute.data.id,
        readModelDB
      );
      const retrievedAndFormattedAttributeSQL = retrievedAttributeSQL
        ? {
            ...retrievedAttributeSQL,
            creationTime: stringToISOString(retrievedAttributeSQL.creationTime),
          }
        : undefined;

      const expectedAttributeSQL: AttributeSQL = {
        id: attribute.data.id,
        name: attribute.data.name,
        description: attribute.data.description,
        metadataVersion: attribute.metadata.version,
        kind: attribute.data.kind,
        creationTime: attribute.data.creationTime.toISOString(),
        code: null,
        origin: null,
      };

      expect(retrievedAndFormattedAttributeSQL).toMatchObject(
        expectedAttributeSQL
      );
    });
  });

  describe("getAttributeById", () => {
    it("attribute found", async () => {
      const attribute: WithMetadata<Attribute> = {
        data: {
          ...getMockAttribute(),
          code: "test code",
          origin: "test origin",
        },
        metadata: { version: 1 },
      };

      await attributeReadModelService.upsertAttribute(attribute);

      const retrievedAttribute =
        await attributeReadModelService.getAttributeById(attribute.data.id);

      expect(retrievedAttribute).toMatchObject(attribute);
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
      const attribute1: WithMetadata<Attribute> = {
        data: {
          ...getMockAttribute(),
        },
        metadata: { version: 1 },
      };
      await attributeReadModelService.upsertAttribute(attribute1);

      const attribute2: WithMetadata<Attribute> = {
        data: {
          ...getMockAttribute(),
        },
        metadata: { version: 1 },
      };
      await attributeReadModelService.upsertAttribute(attribute2);

      const retrievedAttributes =
        await attributeReadModelService.getAllAttributes();
      expect(retrievedAttributes).toMatchObject(
        expect.arrayContaining([attribute1, attribute2])
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
      const attribute: WithMetadata<Attribute> = {
        data: {
          ...getMockAttribute(),
          code: "test code",
          origin: "test origin",
        },
        metadata: { version: 1 },
      };

      await attributeReadModelService.upsertAttribute(attribute);
      expect(
        await retrieveAttributeSQL(attribute.data.id, readModelDB)
      ).toBeDefined();

      await attributeReadModelService.deleteAttributeById(attribute.data.id, 2);
      expect(
        await retrieveAttributeSQL(attribute.data.id, readModelDB)
      ).toBeUndefined();
    });
  });
});
