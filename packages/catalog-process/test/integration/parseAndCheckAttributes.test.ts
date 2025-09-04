import { catalogApi } from "pagopa-interop-api-clients";
import { getMockAttribute } from "pagopa-interop-commons-test/index.js";
import { beforeEach, describe, expect, it } from "vitest";
import { AttributeId, generateId } from "pagopa-interop-models";
import { parseAndCheckAttributes } from "../../src/services/catalogService.js";
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
        [{ id: certified1.id, explicitAttributeVerification: false }],
        [
          { id: certified2.id, explicitAttributeVerification: false },
          { id: certified3.id, explicitAttributeVerification: false },
        ],
      ],
      declared: [
        [{ id: declared1.id, explicitAttributeVerification: false }],
        [
          { id: declared2.id, explicitAttributeVerification: false },
          { id: declared3.id, explicitAttributeVerification: false },
        ],
      ],
      verified: [
        [{ id: verified1.id, explicitAttributeVerification: false }],
        [
          { id: verified2.id, explicitAttributeVerification: false },
          { id: verified3.id, explicitAttributeVerification: false },
        ],
      ],
    };

    const result = await parseAndCheckAttributes(seed, readModelService);

    expect(result).toEqual(seed);
  });

  it.each([
    {
      certified: [
        [{ id: nonExistingAttributeId, explicitAttributeVerification: false }],
      ],
      declared: [[{ id: declared1.id, explicitAttributeVerification: false }]],
      verified: [[{ id: verified1.id, explicitAttributeVerification: false }]],
    },
    {
      certified: [
        [{ id: certified1.id, explicitAttributeVerification: false }],
      ],
      declared: [
        [{ id: nonExistingAttributeId, explicitAttributeVerification: false }],
      ],
      verified: [[{ id: verified1.id, explicitAttributeVerification: false }]],
    },
    {
      certified: [
        [{ id: certified1.id, explicitAttributeVerification: false }],
      ],
      declared: [[{ id: declared1.id, explicitAttributeVerification: false }]],
      verified: [
        [{ id: nonExistingAttributeId, explicitAttributeVerification: false }],
      ],
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
            [{ id: verified1.id, explicitAttributeVerification: false }],
            //     ^ Passing a verified attribute as certified
          ],
          declared: [
            [{ id: declared1.id, explicitAttributeVerification: false }],
          ],
          verified: [
            [{ id: verified1.id, explicitAttributeVerification: false }],
          ],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeNotFound(verified1.id));

    await expect(
      parseAndCheckAttributes(
        {
          certified: [
            [{ id: certified1.id, explicitAttributeVerification: false }],
          ],
          declared: [
            [{ id: declared1.id, explicitAttributeVerification: false }],
            [{ id: certified1.id, explicitAttributeVerification: false }],
            //     ^ Passing a certified attribute as declared
          ],
          verified: [
            [{ id: verified1.id, explicitAttributeVerification: false }],
          ],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeNotFound(certified1.id));

    await expect(
      parseAndCheckAttributes(
        {
          certified: [
            [{ id: certified1.id, explicitAttributeVerification: false }],
          ],
          declared: [
            [{ id: declared1.id, explicitAttributeVerification: false }],
            [{ id: declared2.id, explicitAttributeVerification: false }],
          ],
          verified: [
            [{ id: verified1.id, explicitAttributeVerification: false }],
            [
              { id: verified2.id, explicitAttributeVerification: false },
              { id: declared3.id, explicitAttributeVerification: false },
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
          certified: [
            [
              { id: certified1.id, explicitAttributeVerification: false },
              { id: certified1.id, explicitAttributeVerification: false },
            ],
          ],
          declared: [
            [{ id: declared1.id, explicitAttributeVerification: false }],
          ],
          verified: [
            [{ id: verified1.id, explicitAttributeVerification: false }],
          ],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeDuplicatedInGroup(certified1.id));

    await expect(
      parseAndCheckAttributes(
        {
          certified: [
            [{ id: certified1.id, explicitAttributeVerification: false }],
          ],
          declared: [
            [
              { id: declared2.id, explicitAttributeVerification: false },
              { id: declared2.id, explicitAttributeVerification: false },
            ],
          ],
          verified: [
            [{ id: verified1.id, explicitAttributeVerification: false }],
            [{ id: verified2.id, explicitAttributeVerification: false }],
          ],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeDuplicatedInGroup(declared2.id));

    await expect(
      parseAndCheckAttributes(
        {
          certified: [
            [
              { id: certified1.id, explicitAttributeVerification: false },
              { id: certified2.id, explicitAttributeVerification: false },
            ],
          ],
          declared: [
            [
              { id: declared2.id, explicitAttributeVerification: false },
              { id: declared3.id, explicitAttributeVerification: false },
            ],
          ],
          verified: [
            [
              { id: verified1.id, explicitAttributeVerification: false },
              { id: verified2.id, explicitAttributeVerification: false },
            ],
            [
              { id: verified3.id, explicitAttributeVerification: false },
              { id: verified3.id, explicitAttributeVerification: false },
            ],
          ],
        },
        readModelService
      )
    ).rejects.toThrowError(attributeDuplicatedInGroup(verified3.id));
  });
});
