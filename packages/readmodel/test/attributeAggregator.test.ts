import { getMockAttribute } from "pagopa-interop-commons-test/index.js";
import { describe, it, expect } from "vitest";
import { Attribute, WithMetadata } from "pagopa-interop-models";
import { splitAttributeIntoObjectsSQL } from "./../src/attribute/splitters.js";
import { aggregateAttribute } from "./../src/attribute/aggregators.js";

describe("Attribute aggregator", () => {
  it("should convert an Attribute SQL object into a business logic Attribute", () => {
    const mockAttribute: WithMetadata<Attribute> = {
      data: {
        ...getMockAttribute(),
        origin: "alfa",
        code: "beta",
      },
      metadata: { version: 1 },
    };
    const attributeSQL = splitAttributeIntoObjectsSQL(mockAttribute.data, 1);
    const aggregatedAttribute = aggregateAttribute(attributeSQL);

    expect(aggregatedAttribute).toMatchObject(mockAttribute);
  });

  it("should convert an Attribute SQL object with null values into a business logic Attribute object with undefined values", () => {
    const attribute: WithMetadata<Attribute> = {
      data: {
        ...getMockAttribute(),
      },
      metadata: { version: 1 },
    };
    const attributeSQL = splitAttributeIntoObjectsSQL(attribute.data, 1);
    const aggregatedAttribute = aggregateAttribute(attributeSQL);

    expect(aggregatedAttribute).toMatchObject(attribute);
  });
});
