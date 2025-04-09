/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { getMockAttribute } from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import { Attribute, attributeKind, generateId } from "pagopa-interop-models";
import { attributeNotFound } from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  attributeRegistryService,
} from "../integrationUtils.js";

describe("getAttributeByName", () => {
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
    const attribute = await attributeRegistryService.getAttributeByName(
      attribute1.name,
      genericLogger
    );
    expect(attribute?.data).toEqual(attribute1);
  });
  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    const name = "not-existing";
    expect(
      attributeRegistryService.getAttributeByName(name, genericLogger)
    ).rejects.toThrowError(attributeNotFound(name));
  });
});
