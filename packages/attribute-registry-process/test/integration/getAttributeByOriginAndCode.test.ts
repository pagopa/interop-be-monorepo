/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, expect } from "vitest";
import { getMockAttribute, getMockContext } from "pagopa-interop-commons-test";
import { Attribute, attributeKind } from "pagopa-interop-models";
import { attributeNotFound } from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  attributeRegistryService,
} from "../integrationUtils.js";

describe("getAttributeByOriginAndCode", () => {
  it("should get the attribute if it exists", async () => {
    const attribute1: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      origin: "IPA",
      code: "12345A",
    };
    await addOneAttribute(attribute1);
    const attribute =
      await attributeRegistryService.getAttributeByOriginAndCode(
        {
          origin: "IPA",
          code: "12345A",
        },
        getMockContext({})
      );
    expect(attribute?.data).toEqual(attribute1);
  });
  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    expect(
      attributeRegistryService.getAttributeByOriginAndCode(
        {
          origin: "IPA",
          code: "12345D",
        },
        getMockContext({})
      )
    ).rejects.toThrowError(attributeNotFound("IPA/12345D"));
  });
});
