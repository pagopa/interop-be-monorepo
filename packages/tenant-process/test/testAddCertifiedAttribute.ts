/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  Tenant,
  Attribute,
  unsafeBrandId,
  protobufDecoder,
  TenantCertifiedAttributeAssignedV2,
  TenantCertifiedAttributeV2,
  fromTenantKindV2,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  tenantNotFound,
  attributeNotFound,
  tenantIsNotACertifier,
  certifiedAttributeOriginIsNotCompliantWithCertifier,
  certifiedAttributeAlreadyAssigned,
} from "../src/model/domain/errors.js";
import { ApiCertifiedTenantAttributeSeed } from "../src/model/types.js";
import {
  currentDate,
  getMockAuthData,
  addOneAttribute,
  addOneTenant,
  getMockTenant,
  getMockCertifiedTenantAttribute,
} from "./utils.js";
import {
  postgresDB,
  attributes,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";

export const testAddCertifiedAttributes = (): ReturnType<typeof describe> =>
  describe("addCertifiedAttribute", async () => {
    const tenantAttributeSeed: ApiCertifiedTenantAttributeSeed = {
      id: generateId(),
    };
    const correlationId = generateId();
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "PersistentCertifier",
          certifierId: generateId(),
        },
      ],
      updatedAt: currentDate,
      name: "A requesterTenant",
    };
    const attribute: Attribute = {
      name: "an Attribute",
      id: unsafeBrandId(tenantAttributeSeed.id),
      kind: "Certified",
      description: "an attribute",
      creationTime: new Date(),
      code: "123456",
      origin: requesterTenant.features[0].certifierId,
    };

    const targetTenant: Tenant = { ...getMockTenant(), id: generateId() };
    const mockAuthData = getMockAuthData(requesterTenant.id);

    it("Should add the certified attribute if certifiedTenantAttribute doesn't exist", async () => {
      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await tenantService.addCertifiedAttribute(targetTenant.id, {
        tenantAttributeSeed,
        authData: mockAuthData,
        correlationId,
      });
      const writtenEvent = await readLastEventByStreamId(
        targetTenant.id,
        "tenant",
        postgresDB
      );
      if (!writtenEvent) {
        fail("Update failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: targetTenant.id,
        version: "1",
        type: "TenantCertifiedAttributeAssigned",
      });
      const writtenPayload = protobufDecoder(
        TenantCertifiedAttributeAssignedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...targetTenant,
        attributes: [
          {
            id: unsafeBrandId(tenantAttributeSeed.id),
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(
              Number(
                (
                  writtenPayload.tenant!.attributes[0].sealedValue as {
                    oneofKind: "certifiedAttribute";
                    certifiedAttribute: TenantCertifiedAttributeV2;
                  }
                ).certifiedAttribute.assignmentTimestamp
              )
            ),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    });
    it("Should add the certified attribute if certifiedTenantAttribute exist", async () => {
      const tenantWithCertifiedAttribute: Tenant = {
        ...targetTenant,
        attributes: [
          {
            ...getMockCertifiedTenantAttribute(),
            id: unsafeBrandId(tenantAttributeSeed.id),
            revocationTimestamp: new Date(),
          },
        ],
      };

      await addOneAttribute(attribute, attributes);
      await addOneTenant(tenantWithCertifiedAttribute, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await tenantService.addCertifiedAttribute(
        tenantWithCertifiedAttribute.id,
        {
          tenantAttributeSeed,
          authData: mockAuthData,
          correlationId,
        }
      );
      const writtenEvent = await readLastEventByStreamId(
        tenantWithCertifiedAttribute.id,
        "tenant",
        postgresDB
      );
      if (!writtenEvent) {
        fail("Update failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: tenantWithCertifiedAttribute.id,
        version: "1",
        type: "TenantCertifiedAttributeAssigned",
      });
      const writtenPayload = protobufDecoder(
        TenantCertifiedAttributeAssignedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...tenantWithCertifiedAttribute,
        attributes: [
          {
            id: unsafeBrandId(tenantAttributeSeed.id),
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(
              Number(
                (
                  writtenPayload.tenant!.attributes[0].sealedValue as {
                    oneofKind: "certifiedAttribute";
                    certifiedAttribute: TenantCertifiedAttributeV2;
                  }
                ).certifiedAttribute.assignmentTimestamp
              )
            ),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    });
    it("Should throw tenant not found", async () => {
      await addOneAttribute(attribute, attributes);
      expect(
        tenantService.addCertifiedAttribute(targetTenant.id, {
          tenantAttributeSeed,
          authData: mockAuthData,
          correlationId,
        })
      ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
    });
    it("Should throw attribute not found", async () => {
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);

      expect(
        tenantService.addCertifiedAttribute(targetTenant.id, {
          tenantAttributeSeed,
          authData: mockAuthData,
          correlationId,
        })
      ).rejects.toThrowError(attributeNotFound(attribute.id));
    });
    it("Should throw tenant is not a certifier", async () => {
      const requesterTenant: Tenant = {
        ...getMockTenant(),
        updatedAt: currentDate,
        name: "A requesterTenant",
      };
      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);

      expect(
        tenantService.addCertifiedAttribute(targetTenant.id, {
          tenantAttributeSeed,
          authData: getMockAuthData(requesterTenant.id),
          correlationId,
        })
      ).rejects.toThrowError(tenantIsNotACertifier(requesterTenant.id));
    });
    it("Should throw certifiedAttributeOriginIsNotCompliantWithCertifier", async () => {
      const notCompliantOriginAttribute: Attribute = {
        ...attribute,
        origin: generateId(),
      };
      await addOneAttribute(notCompliantOriginAttribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);

      expect(
        tenantService.addCertifiedAttribute(targetTenant.id, {
          tenantAttributeSeed,
          authData: mockAuthData,
          correlationId,
        })
      ).rejects.toThrowError(
        certifiedAttributeOriginIsNotCompliantWithCertifier(
          notCompliantOriginAttribute.origin!,
          requesterTenant.id,
          targetTenant.id,
          requesterTenant.features[0].certifierId
        )
      );
    });
    it("Should throw certifiedAttributeAlreadyAssigned", async () => {
      const tenantAlreadyAssigned: Tenant = {
        ...targetTenant,
        attributes: [
          {
            id: attribute.id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
      };
      await addOneAttribute(attribute, attributes);
      await addOneTenant(tenantAlreadyAssigned, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      expect(
        tenantService.addCertifiedAttribute(tenantAlreadyAssigned.id, {
          tenantAttributeSeed,
          authData: mockAuthData,
          correlationId,
        })
      ).rejects.toThrowError(
        certifiedAttributeAlreadyAssigned(attribute.id, requesterTenant.id)
      );
    });
  });
