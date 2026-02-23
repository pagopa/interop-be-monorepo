import { catalogApi } from "pagopa-interop-api-clients";
import { getMockAttribute } from "pagopa-interop-commons-test/index.js";
import { beforeEach, describe, expect, it } from "vitest";
import { AttributeId, generateId } from "pagopa-interop-models";
import { parseAndCheckAttributes } from "../../src/services/eserviceTemplateService.js";
import { addOneAttribute, readModelService } from "../integrationUtils.js";
import {
  attributeDuplicatedInGroup,
  attributeNotFound,
} from "../../src/model/domain/errors.js";

describe("parseAndCheckAttributes", () => {
  const certified1 = getMockAttribute("Certified");
  const certified2 = getMockAttribute("Certified");
  const certified3 = getMockAttribute("Certified");

  const declared1 = getMockAttribute("Declared");
  const declared2 = getMockAttribute("Declared");
  const declared3 = getMockAttribute("Declared");

  const verified1 = getMockAttribute("Verified");
  const verified2 = getMockAttribute("Verified");
  const verified3 = getMockAttribute("Verified");

  const nonExistingAttributeId = generateId<AttributeId>();

  beforeEach(async () => {
    await addOneAttribute(certified1);
    await addOneAttribute(certified2);
    await addOneAttribute(certified3);
    await addOneAttribute(declared1);
    await addOneAttribute(declared2);
    await addOneAttribute(declared3);
    await addOneAttribute(verified1);
    await addOneAttribute(verified2);
    await addOneAttribute(verified3);
  });

  it("should parse and check attributes correctly", async () => {
    const seed: catalogApi.AttributesSeed = {
      certified: [
        [{ id: certified1.id }],
        [{ id: certified2.id }, { id: certified3.id }],
      ],
      declared: [
        [{ id: declared1.id }],
        [{ id: declared2.id }, { id: declared3.id }],
      ],
      verified: [
        [{ id: verified1.id }],
        [{ id: verified2.id }, { id: verified3.id }],
      ],
    };

    const result = await parseAndCheckAttributes(seed, readModelService);

    expect(result).toEqual(seed);
  });

  it.each([
    {
      certified: [[{ id: nonExistingAttributeId }]],
      declared: [[{ id: declared1.id }]],
      verified: [[{ id: verified1.id }]],
    },
    {
      certified: [[{ id: certified1.id }]],
      declared: [[{ id: nonExistingAttributeId }]],
      verified: [[{ id: verified1.id }]],
    },
    {
      certified: [[{ id: certified1.id }]],
      declared: [[{ id: declared1.id }]],
      verified: [[{ id: nonExistingAttributeId }]],
    },
  ])(
    "Should throw attributeNotFound when an attribute in the seed does not exist (seed #%#)",
    async (seed) => {
      await expect(
        parseAndCheckAttributes(seed, readModelService)
      ).rejects.toThrow(attributeNotFound(nonExistingAttributeId));
    }
  );

  it("Should throw attributeNotFound in case of attribute kind mismatch (seed #%#)", async () => {
    await expect(
      parseAndCheckAttributes(
        {
          certified: [
            [{ id: verified1.id }],
            //     ^ Passing a verified attribute as certified
          ],
          declared: [[{ id: declared1.id }]],
          verified: [[{ id: verified1.id }]],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeNotFound(verified1.id));

    await expect(
      parseAndCheckAttributes(
        {
          certified: [[{ id: certified1.id }]],
          declared: [
            [{ id: declared1.id }],
            [{ id: certified1.id }],
            //     ^ Passing a certified attribute as declared
          ],
          verified: [[{ id: verified1.id }]],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeNotFound(certified1.id));

    await expect(
      parseAndCheckAttributes(
        {
          certified: [[{ id: certified1.id }]],
          declared: [[{ id: declared1.id }], [{ id: declared2.id }]],
          verified: [
            [{ id: verified1.id }],
            [
              { id: verified2.id },
              { id: declared3.id },
              //    ^ Passing a declared attribute as verified
            ],
          ],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeNotFound(declared3.id));
  });

  it("Should throw attributeDuplicatedInGroup in case of attribute duplicated in group", async () => {
    await expect(
      parseAndCheckAttributes(
        {
          certified: [[{ id: certified1.id }, { id: certified1.id }]],
          declared: [[{ id: declared1.id }]],
          verified: [[{ id: verified1.id }]],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeDuplicatedInGroup(certified1.id));

    await expect(
      parseAndCheckAttributes(
        {
          certified: [[{ id: certified1.id }]],
          declared: [[{ id: declared2.id }, { id: declared2.id }]],
          verified: [[{ id: verified1.id }], [{ id: verified2.id }]],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeDuplicatedInGroup(declared2.id));

    await expect(
      parseAndCheckAttributes(
        {
          certified: [[{ id: certified1.id }, { id: certified2.id }]],
          declared: [[{ id: declared2.id }, { id: declared3.id }]],
          verified: [
            [{ id: verified1.id }, { id: verified2.id }],
            [{ id: verified3.id }, { id: verified3.id }],
          ],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeDuplicatedInGroup(verified3.id));
  });
});
