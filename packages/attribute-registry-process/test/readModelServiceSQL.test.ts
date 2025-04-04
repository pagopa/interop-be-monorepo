/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable functional/no-let */
import { describe, expect, it, beforeEach } from "vitest";
import {
  Attribute,
  AttributeId,
  attributeKind,
  generateId,
} from "pagopa-interop-models";
import { getMockAttribute } from "pagopa-interop-commons-test/index.js";
import { genericLogger } from "pagopa-interop-commons";
import { attributeNotFound } from "../src/model/domain/errors.js";
import {
  addOneAttribute,
  attributeRegistryService,
  readModelService,
} from "./utils.js";

const mockAttribute = getMockAttribute();

describe("readModelService", () => {
  let attribute1: Attribute;
  let attribute2: Attribute;
  let attribute3: Attribute;
  let attribute4: Attribute;
  let attribute5: Attribute;
  let attribute6: Attribute;
  let attribute7: Attribute;

  beforeEach(async () => {
    attribute1 = {
      ...mockAttribute,
      id: generateId(),
      name: "attribute 001 test",
      kind: attributeKind.certified,
      origin: "IPA",
      code: "12345A",
    };
    await addOneAttribute(attribute1);

    attribute2 = {
      ...mockAttribute,
      id: generateId(),
      name: "attribute 002 test",
      kind: attributeKind.certified,
      origin: "IPA",
      code: "12345B",
    };
    await addOneAttribute(attribute2);

    attribute3 = {
      ...mockAttribute,
      id: generateId(),
      name: "attribute 003 test",
      kind: attributeKind.certified,
      origin: "IPA",
      code: "12345C",
    };
    await addOneAttribute(attribute3);

    attribute4 = {
      ...mockAttribute,
      id: generateId(),
      name: "attribute 004",
      kind: attributeKind.declared,
    };
    await addOneAttribute(attribute4);

    attribute5 = {
      ...mockAttribute,
      id: generateId(),
      name: "attribute 005",
      kind: attributeKind.declared,
    };
    await addOneAttribute(attribute5);

    attribute6 = {
      ...mockAttribute,
      id: generateId(),
      name: "attribute 006",
      kind: attributeKind.verified,
    };
    await addOneAttribute(attribute6);

    attribute7 = {
      ...mockAttribute,
      id: generateId(),
      name: "attribute 007",
      kind: attributeKind.verified,
    };
    await addOneAttribute(attribute7);
  });

  describe("getAttributesByIds", () => {
    it("should get the attributes if they exist", async () => {
      const result = await readModelService.getAttributesByIds({
        ids: [attribute1.id, attribute2.id, attribute3.id],
        offset: 0,
        limit: 50,
      });

      expect(result.totalCount).toBe(3);
      expect(result.results).toEqual([attribute1, attribute2, attribute3]);
    });
    it("should not get the attributes if they don't exist", async () => {
      const result = await readModelService.getAttributesByIds({
        ids: [generateId(), generateId()],
        offset: 0,
        limit: 50,
      });
      expect(result.totalCount).toBe(0);
      expect(result.results).toEqual([]);
    });
    it("should not get any attributes if the requested ids list is empty", async () => {
      const result = await readModelService.getAttributesByIds({
        ids: [],
        offset: 0,
        limit: 50,
      });
      expect(result.totalCount).toBe(0);
      expect(result.results).toEqual([]);
    });
  });
  describe("getAttributesByKindsNameOrigin", () => {
    it("should get the attributes if they exist (parameters: kinds, name, origin)", async () => {
      const result = await readModelService.getAttributesByKindsNameOrigin({
        kinds: [attributeKind.certified],
        name: "test",
        origin: "IPA",
        offset: 0,
        limit: 50,
      });
      expect(result.totalCount).toBe(3);
      expect(result.results).toEqual([attribute1, attribute2, attribute3]);
    });
    it("should get the attributes if they exist (parameters: kinds only)", async () => {
      const result = await readModelService.getAttributesByKindsNameOrigin({
        kinds: [attributeKind.declared],
        offset: 0,
        limit: 50,
      });
      expect(result.totalCount).toBe(2);
      expect(result.results).toEqual([attribute4, attribute5]);
    });
    it("should get the attributes if they exist (parameters: name only)", async () => {
      const result = await readModelService.getAttributesByKindsNameOrigin({
        kinds: [],
        name: "test",
        offset: 0,
        limit: 50,
      });
      expect(result.totalCount).toBe(3);
      expect(result.results).toEqual([attribute1, attribute2, attribute3]);
    });
    it("should get the attributes if they exist (parameters: origin only)", async () => {
      const result = await readModelService.getAttributesByKindsNameOrigin({
        kinds: [],
        origin: "IPA",
        offset: 0,
        limit: 50,
      });
      expect(result.totalCount).toBe(3);
      expect(result.results).toEqual([attribute1, attribute2, attribute3]);
    });
    it("should get all the attributes if no parameter is passed", async () => {
      const result = await readModelService.getAttributesByKindsNameOrigin({
        kinds: [],
        offset: 0,
        limit: 50,
      });
      expect(result.totalCount).toBe(7);
      expect(result.results).toEqual([
        attribute1,
        attribute2,
        attribute3,
        attribute4,
        attribute5,
        attribute6,
        attribute7,
      ]);
    });
    it("should get the attributes if no parameter is passed (pagination: limit)", async () => {
      const result = await readModelService.getAttributesByKindsNameOrigin({
        kinds: [],
        offset: 0,
        limit: 5,
      });
      expect(result.totalCount).toBe(7);
      expect(result.results.length).toBe(5);
    });
    it("should get the attributes if no parameter is passed (pagination: offset, limit)", async () => {
      const result = await readModelService.getAttributesByKindsNameOrigin({
        kinds: [],
        offset: 5,
        limit: 5,
      });
      expect(result.totalCount).toBe(7);
      expect(result.results.length).toBe(2);
    });
    it("should not get the attributes if they don't exist", async () => {
      const result = await readModelService.getAttributesByKindsNameOrigin({
        kinds: [],
        name: "latest attribute",
        offset: 0,
        limit: 50,
      });
      expect(result.totalCount).toBe(0);
      expect(result.results).toEqual([]);
    });
  });
  describe("getAttributeById", () => {
    it("should get the attribute if it exists", async () => {
      const attribute = await attributeRegistryService.getAttributeById(
        attribute1.id,
        genericLogger
      );
      expect(attribute?.data).toEqual(attribute1);
    });
    it("should throw attributeNotFound if the attribute doesn't exist", async () => {
      const id = generateId<AttributeId>();
      expect(
        attributeRegistryService.getAttributeById(id, genericLogger)
      ).rejects.toThrowError(attributeNotFound(id));
    });
  });
  describe("getAttributeByName", () => {
    it("should get the attribute if it exists", async () => {
      const attribute = await attributeRegistryService.getAttributeByName(
        attribute1.name,
        genericLogger
      );
      expect(attribute?.data).toEqual(attribute1);
    });
    it("should throw attributeNotFound if the attribute doesn't exist", async () => {
      const name = "not-existing";
      expect(
        attributeRegistryService.getAttributeByName(name, genericLogger)
      ).rejects.toThrowError(attributeNotFound(name));
    });
  });
  describe("getAttributeByOriginAndCode", () => {
    it("should get the attribute if it exists", async () => {
      const attribute =
        await attributeRegistryService.getAttributeByOriginAndCode(
          {
            origin: "IPA",
            code: "12345A",
          },
          genericLogger
        );
      expect(attribute?.data).toEqual(attribute1);
    });
    it("should throw attributeNotFound if the attribute doesn't exist", async () => {
      expect(
        attributeRegistryService.getAttributeByOriginAndCode(
          {
            origin: "IPA",
            code: "12345D",
          },
          genericLogger
        )
      ).rejects.toThrowError(attributeNotFound("IPA/12345D"));
    });
  });
});
