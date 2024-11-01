/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { getMockAttribute } from "pagopa-interop-commons-test/index.js";
import { Attribute, generateId, attributeKind } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { attributeNotFound } from "../src/model/domain/errors.js";
import { addOneAttribute, attributeRegistryService } from "./utils.js";

describe("getAttributeByOriginAndCode", async () => {
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

  it("should get the attribute if it exists", async () => {
    const attribute =
      await attributeRegistryService.getAttributeByOriginAndCode(
        {
          origin: "IPA",
          code: "12345A",
        },
        genericLogger
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
        genericLogger
      )
    ).rejects.toThrowError(attributeNotFound("IPA/12345D"));
  });
});
