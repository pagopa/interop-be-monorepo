import { Attribute, attributeKind, generateId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test/index.js";
import { addOneAttribute, readModelService } from "./utils.js";

describe("getAttributesByKindsNameOrigin", async () => {
  const mockAttribute = getMockAttribute();

  const attribute1: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 001 test",
    kind: attributeKind.certified,
    origin: "IPA",
    code: "12345A",
  };

  const attribute2: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 002 test",
    kind: attributeKind.certified,
    origin: "IPA",
    code: "12345B",
  };

  const attribute3: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 003 test",
    kind: attributeKind.certified,
    origin: "IPA",
    code: "12345C",
  };

  const attribute4: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 004",
    kind: attributeKind.declared,
  };

  const attribute5: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 005",
    kind: attributeKind.declared,
  };

  const attribute6: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 006",
    kind: attributeKind.verified,
  };

  const attribute7: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 007",
    kind: attributeKind.verified,
  };

  it("should get the attributes if they exist (parameters: kinds, name, origin)", async () => {
    await addOneAttribute(attribute1);
    await addOneAttribute(attribute2);
    await addOneAttribute(attribute3);

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
    await addOneAttribute(attribute4);
    await addOneAttribute(attribute5);

    const result = await readModelService.getAttributesByKindsNameOrigin({
      kinds: [attributeKind.declared],
      offset: 0,
      limit: 50,
    });
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([attribute4, attribute5]);
  });
  it("should get the attributes if they exist (parameters: name only)", async () => {
    await addOneAttribute(attribute1);
    await addOneAttribute(attribute2);
    await addOneAttribute(attribute3);

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
    await addOneAttribute(attribute1);
    await addOneAttribute(attribute2);
    await addOneAttribute(attribute3);

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
    await addOneAttribute(attribute1);
    await addOneAttribute(attribute2);
    await addOneAttribute(attribute3);
    await addOneAttribute(attribute4);
    await addOneAttribute(attribute5);
    await addOneAttribute(attribute6);
    await addOneAttribute(attribute7);

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
    await addOneAttribute(attribute1);
    await addOneAttribute(attribute2);
    await addOneAttribute(attribute3);
    await addOneAttribute(attribute4);
    await addOneAttribute(attribute5);
    await addOneAttribute(attribute6);
    await addOneAttribute(attribute7);

    const result = await readModelService.getAttributesByKindsNameOrigin({
      kinds: [],
      offset: 0,
      limit: 5,
    });
    expect(result.totalCount).toBe(7);
    expect(result.results.length).toBe(5);
  });
  it("should get the attributes if no parameter is passed (pagination: offset, limit)", async () => {
    await addOneAttribute(attribute1);
    await addOneAttribute(attribute2);
    await addOneAttribute(attribute3);
    await addOneAttribute(attribute4);
    await addOneAttribute(attribute5);
    await addOneAttribute(attribute6);
    await addOneAttribute(attribute7);

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
