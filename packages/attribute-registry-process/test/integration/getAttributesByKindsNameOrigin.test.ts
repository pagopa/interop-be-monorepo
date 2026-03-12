/* eslint-disable functional/no-let */
import { getMockAttribute } from "pagopa-interop-commons-test";
import { Attribute, generateId, attributeKind } from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import { addOneAttribute, readModelService } from "../integrationUtils.js";

describe("getAttributesByKindsNameOrigin", () => {
  let attribute1: Attribute;
  let attribute2: Attribute;
  let attribute3: Attribute;
  let attribute4: Attribute;
  let attribute5: Attribute;
  let attribute6: Attribute;
  let attribute7: Attribute;

  const mockAttribute = getMockAttribute();

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
