/* eslint-disable functional/no-let */
import { getMockAttribute } from "pagopa-interop-commons-test";
import { attributeKind } from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import { addOneAttribute, readModelService } from "../integrationUtils.js";

describe("getAttributesByKindsNameOrigin", () => {
  const attribute1 = {
    ...getMockAttribute(attributeKind.certified),
    name: "attribute 001 test",
    origin: "IPA",
    code: "12345A",
  };
  const attribute2 = {
    ...getMockAttribute(attributeKind.certified),
    name: "attribute 002 test",
    origin: "IPA",
    code: "12345B",
  };
  const attribute3 = {
    ...getMockAttribute(attributeKind.certified),
    name: "attribute 003 test",
    origin: "IPA",
    code: "12345C",
  };
  const attribute4 = {
    ...getMockAttribute(attributeKind.declared),
    name: "attribute 004",
  };
  const attribute5 = {
    ...getMockAttribute(attributeKind.declared),
    name: "attribute 005",
  };
  const attribute6 = {
    ...getMockAttribute(attributeKind.verified),
    name: "attribute 006",
  };
  const attribute7 = {
    ...getMockAttribute(attributeKind.verified),
    name: "attribute 007",
  };

  beforeEach(async () => {
    await addOneAttribute(attribute1);
    await addOneAttribute(attribute2);
    await addOneAttribute(attribute3);
    await addOneAttribute(attribute4);
    await addOneAttribute(attribute5);
    await addOneAttribute(attribute6);
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
