import { getMockAttribute } from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import { Attribute } from "pagopa-interop-models";
import { AttributeSQL } from "pagopa-interop-readmodel-models";
import { splitAttributeIntoObjectsSQL } from "../../src/attribute/splitters.js";

describe("Attribute Splitter", () => {
  it("should convert an Attribute into an AttributeSQL", () => {
    const mockAttribute: Attribute = {
      ...getMockAttribute(),
      origin: "alfa",
      code: "beta",
    };
    const attributeSQL = splitAttributeIntoObjectsSQL(mockAttribute, 1);
    const expectedAttributeSQL: AttributeSQL = {
      ...mockAttribute,
      metadataVersion: 1,
      creationTime: mockAttribute.creationTime.toISOString(),
      origin: "alfa",
      code: "beta",
    };

    expect(attributeSQL).toStrictEqual(expectedAttributeSQL);
  });

  it("should transform undefined into null", () => {
    const mockAttribute: Attribute = {
      ...getMockAttribute(),
      origin: undefined,
      code: undefined,
    };
    const attributeSQL = splitAttributeIntoObjectsSQL(mockAttribute, 1);
    const expectedAttributeSQL: AttributeSQL = {
      ...mockAttribute,
      metadataVersion: 1,
      creationTime: mockAttribute.creationTime.toISOString(),
      origin: null,
      code: null,
    };

    expect(attributeSQL).toStrictEqual(expectedAttributeSQL);
  });
});
