import { attributeRegistryApi, catalogApi } from "pagopa-interop-api-clients";
import { AttributeId, generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { toBffCatalogApiDescriptorAttributes } from "../src/api/catalogApiConverter.js";
import { attributeNotExists } from "../src/model/errors.js";

describe("catalogApiConverter", () => {
  describe("toBffCatalogApiDescriptorAttributes", () => {
    const certifiedAttributeId = generateId<AttributeId>();
    const certifiedDiscreteAttributeId = generateId<AttributeId>();
    const declaredAttributeId = generateId<AttributeId>();
    const verifiedAttributeId = generateId<AttributeId>();

    const registryAttributes: attributeRegistryApi.Attribute[] = [
      {
        id: certifiedAttributeId,
        name: "certified attribute",
        description: "certified description",
        kind: "CERTIFIED",
        creationTime: new Date().toJSON(),
      },
      {
        id: certifiedDiscreteAttributeId,
        name: "certified discrete attribute",
        description: "certified discrete description",
        kind: "CERTIFIED_DISCRETE",
        creationTime: new Date().toJSON(),
      },
      {
        id: declaredAttributeId,
        name: "declared attribute",
        description: "declared description",
        kind: "DECLARED",
        creationTime: new Date().toJSON(),
      },
      {
        id: verifiedAttributeId,
        name: "verified attribute",
        description: "verified description",
        kind: "VERIFIED",
        creationTime: new Date().toJSON(),
      },
    ];

    it("should set descriptor attribute kind from the attribute registry", () => {
      const descriptorAttributes: catalogApi.Attributes = {
        certified: [
          [
            {
              id: certifiedAttributeId,
              explicitAttributeVerification: false,
            },
            {
              id: certifiedDiscreteAttributeId,
              explicitAttributeVerification: false,
              discreteConfig: {
                comparator: "GTE",
                threshold: 1,
              },
            },
          ],
        ],
        declared: [
          [
            {
              id: declaredAttributeId,
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [
          [
            {
              id: verifiedAttributeId,
              explicitAttributeVerification: true,
            },
          ],
        ],
      };

      const result = toBffCatalogApiDescriptorAttributes(
        registryAttributes,
        descriptorAttributes
      );

      expect(result.certified[0][0]).toEqual({
        id: certifiedAttributeId,
        name: "certified attribute",
        description: "certified description",
        explicitAttributeVerification: false,
        kind: "CERTIFIED",
      });
      expect(result.certified[0][1]).toEqual({
        id: certifiedDiscreteAttributeId,
        name: "certified discrete attribute",
        description: "certified discrete description",
        explicitAttributeVerification: false,
        kind: "CERTIFIED_DISCRETE",
        discreteConfig: {
          comparator: "GTE",
          threshold: 1,
        },
      });
      expect(result.declared[0][0]).toEqual({
        id: declaredAttributeId,
        name: "declared attribute",
        description: "declared description",
        explicitAttributeVerification: false,
        kind: "DECLARED",
      });
      expect(result.verified[0][0]).toEqual({
        id: verifiedAttributeId,
        name: "verified attribute",
        description: "verified description",
        explicitAttributeVerification: true,
        kind: "VERIFIED",
      });
    });

    it("should throw attributeNotExists when registry data is missing", () => {
      const missingAttributeId = generateId<AttributeId>();
      const descriptorAttributes: catalogApi.Attributes = {
        certified: [
          [
            {
              id: missingAttributeId,
              explicitAttributeVerification: false,
            },
          ],
        ],
        declared: [],
        verified: [],
      };

      expect(() =>
        toBffCatalogApiDescriptorAttributes(
          registryAttributes,
          descriptorAttributes
        )
      ).toThrow(attributeNotExists(missingAttributeId));
    });
  });
});
