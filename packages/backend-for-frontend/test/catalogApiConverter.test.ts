import {
  attributeRegistryApi,
  bffApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { AttributeId, generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiEService,
  toBffCatalogTenant,
} from "../src/api/catalogApiConverter.js";
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

  describe("toBffCatalogTenant", () => {
    it("should preserve tenant information and notifications without hierarchy", () => {
      const tenant = getMockedApiTenant();
      const result = toBffCatalogTenant(tenant, true);

      expect(result).toEqual({
        id: tenant.id,
        name: tenant.name,
        selfcareId: tenant.selfcareId,
        subUnitType: tenant.subUnitType,
        parentTenants: undefined,
        hasUnreadNotifications: true,
      });
      expect(bffApi.CatalogTenant.parse(result).parentTenants).toBeUndefined();
    });

    it("should return the parent and root tenants when available", () => {
      const parentTenants: tenantApi.ParentTenant[] = [
        { id: generateId(), name: "Tenant AOO", subUnitType: "AOO" },
        { id: generateId(), name: "Tenant root" },
      ];
      const tenant = {
        ...getMockedApiTenant(),
        name: "Tenant UO",
        subUnitType: "UO" as const,
        parentTenants,
      };

      const result = toBffCatalogTenant(tenant);

      expect(bffApi.CatalogTenant.parse(result)).toMatchObject({
        id: tenant.id,
        name: "Tenant UO",
        subUnitType: "UO",
        parentTenants,
        hasUnreadNotifications: false,
      });
    });
  });

  describe("toBffCatalogApiEService", () => {
    it("should propagate the producer hierarchy while preserving catalog fields", () => {
      const producer = {
        ...getMockedApiTenant(),
        name: "Tenant UO",
        subUnitType: "UO" as const,
        parentTenants: [
          { id: generateId(), name: "Tenant AOO", subUnitType: "AOO" as const },
          { id: generateId(), name: "Tenant root" },
        ],
      };
      const eservice = {
        ...getMockedApiEservice(),
        producerId: producer.id,
      };

      const result = toBffCatalogApiEService(eservice, producer, true, true);

      expect(result.producer).toEqual({
        id: eservice.producerId,
        name: producer.name,
        selfcareId: producer.selfcareId,
        subUnitType: "UO",
        parentTenants: producer.parentTenants,
      });
      expect(bffApi.CatalogEService.parse(result)).toMatchObject({
        id: eservice.id,
        name: eservice.name,
        description: eservice.description,
        producer: {
          id: producer.id,
          name: producer.name,
          subUnitType: "UO",
          parentTenants: producer.parentTenants,
        },
        isMine: true,
        hasUnreadNotifications: true,
      });
    });
  });
});
