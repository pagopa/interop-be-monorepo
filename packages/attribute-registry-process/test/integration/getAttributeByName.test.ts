/* eslint-disable @typescript-eslint/no-floating-promises */
import { getMockAttribute, getMockContext } from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import { Attribute, attributeKind } from "pagopa-interop-models";
import { attributeNotFound } from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  attributeRegistryService,
} from "../integrationUtils.js";

describe("getAttributeByName", () => {
  it("should get the attribute if it exists", async () => {
    const attribute1: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      origin: "IPA",
    };
    await addOneAttribute(attribute1);
    const attribute = await attributeRegistryService.getAttributeByName(
      attribute1.name,
      getMockContext({})
    );
    expect(attribute?.data).toEqual(attribute1);
  });
  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    const name = "not-existing";
    expect(
      attributeRegistryService.getAttributeByName(name, getMockContext({}))
    ).rejects.toThrowError(attributeNotFound(name));
  });
});
