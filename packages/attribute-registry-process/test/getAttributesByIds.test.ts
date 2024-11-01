import { Attribute, attributeKind, generateId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test/index.js";
import { addOneAttribute, readModelService } from "./utils.js";

describe("getAttributesByIds", async () => {
  const mockAttribute = getMockAttribute();

  const attribute1: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 001 test",
    kind: attributeKind.certified,
    origin: "IPA",
    code: "12345A",
  };
  await addOneAttribute(attribute1);

  const attribute2: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 002 test",
    kind: attributeKind.certified,
    origin: "IPA",
    code: "12345B",
  };
  await addOneAttribute(attribute2);

  const attribute3: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 003 test",
    kind: attributeKind.certified,
    origin: "IPA",
    code: "12345C",
  };
  await addOneAttribute(attribute3);

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
