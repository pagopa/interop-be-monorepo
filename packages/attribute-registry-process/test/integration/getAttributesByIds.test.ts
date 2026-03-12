/* eslint-disable functional/no-let */
import { Attribute, attributeKind, generateId } from "pagopa-interop-models";
import { describe, it, expect, beforeEach } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import { addOneAttribute, readModelService } from "../integrationUtils.js";

describe("getAttributesByIds", () => {
  let attribute1: Attribute;
  let attribute2: Attribute;
  let attribute3: Attribute;

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
  });

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
