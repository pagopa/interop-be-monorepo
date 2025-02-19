import { getMockAttribute } from "pagopa-interop-commons-test/index.js";
import { describe, it, expect } from "vitest";
import { Attribute, WithMetadata } from "pagopa-interop-models";
import { AttributeSQL } from "pagopa-interop-readmodel-models";
import { attributeSQLtoAttribute } from "./../src/attribute/aggregators.js";

describe("Attribute Aggregator", () => {
  it("should convert Attribute object as data model into an Attribute object as business model", () => {
    const mockAttribute = getMockAttribute();
    const attributeSQL: AttributeSQL = {
      ...mockAttribute,
      metadataVersion: 1,
      creationTime: mockAttribute.creationTime.toISOString(),
      code: "code",
      origin: "origin",
    };

    const attribute = attributeSQLtoAttribute(attributeSQL);

    const expectedAttribute: WithMetadata<Attribute> = {
      data: {
        ...mockAttribute,
        creationTime: mockAttribute.creationTime,
        code: "code",
        origin: "origin",
      },
      metadata: { version: 1 },
    };
    expect(attribute).toEqual(expectedAttribute);
  });

  it("should convert Attribute object with null values as data model into an Attribute object with undefined values as business model", () => {
    const mockAttribute = getMockAttribute();
    const attributeSQL: AttributeSQL = {
      ...mockAttribute,
      metadataVersion: 1,
      creationTime: mockAttribute.creationTime.toISOString(),
      code: null,
      origin: null,
    };

    const attribute = attributeSQLtoAttribute(attributeSQL);

    const expectedAttribute: WithMetadata<Attribute> = {
      data: {
        ...mockAttribute,
        code: undefined,
        origin: undefined,
      },
      metadata: { version: 1 },
    };
    expect(attribute).toEqual(expectedAttribute);
  });
});
