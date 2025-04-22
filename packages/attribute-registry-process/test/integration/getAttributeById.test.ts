/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  AttributeId,
  attributeKind,
  Attribute,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockAttribute, getMockContext } from "pagopa-interop-commons-test";
import { attributeNotFound } from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  attributeRegistryService,
} from "../integrationUtils.js";

describe("getAttributeById", () => {
  it("should get the attribute if it exists", async () => {
    const attribute1: Attribute = {
      ...getMockAttribute(),
      id: generateId(),
      name: "attribute 001 test",
      kind: attributeKind.certified,
      origin: "IPA",
      code: "12345A",
    };
    await addOneAttribute(attribute1);
    const attribute = await attributeRegistryService.getAttributeById(
      attribute1.id,
      getMockContext({})
    );
    expect(attribute?.data).toEqual(attribute1);
  });
  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    const id = generateId<AttributeId>();
    expect(
      attributeRegistryService.getAttributeById(id, getMockContext({}))
    ).rejects.toThrowError(attributeNotFound(id));
  });
});
