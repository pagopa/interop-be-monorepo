import { fail } from "assert";
import { attributeKind } from "pagopa-interop-models";
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { readLastEventByStreamId } from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  Tenant,
  Attribute,
  unsafeBrandId,
  protobufDecoder,
  TenantCertifiedAttributeAssignedV2,
  fromTenantKindV2,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";
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

export const testAddCertifiedAttribute = (): ReturnType<typeof describe> =>
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
    };
    const attribute: Attribute = {
      name: "an Attribute",
      id: unsafeBrandId(tenantAttributeSeed.id),
      kind: attributeKind.certified,
      description: "an attribute",
      creationTime: new Date(),
      code: "123456",
      origin: requesterTenant.features[0].certifierId,
    };

    const targetTenant: Tenant = getMockTenant();
    const organizationId = getMockAuthData(requesterTenant.id).organizationId;

    it("Should add the certified attribute if the tenant doesn't have that", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await tenantService.addCertifiedAttribute(targetTenant.id, {
        tenantAttributeSeed,
        organizationId,
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
            assignmentTimestamp: new Date(),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      vi.useRealTimers();
    });
    it("Should re-assign the certified attribute if it was revoked", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
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
          organizationId,
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
            assignmentTimestamp: new Date(),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      vi.useRealTimers();
    });
    it("Should throw certifiedAttributeAlreadyAssigned if the attribute was already assigned", async () => {
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
          organizationId,
          correlationId,
        })
      ).rejects.toThrowError(
        certifiedAttributeAlreadyAssigned(
          attribute.id,
          tenantAlreadyAssigned.id
        )
      );
    });
    it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
      await addOneAttribute(attribute, attributes);
      expect(
        tenantService.addCertifiedAttribute(targetTenant.id, {
          tenantAttributeSeed,
          organizationId,
          correlationId,
        })
      ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);

      expect(
        tenantService.addCertifiedAttribute(targetTenant.id, {
          tenantAttributeSeed,
          organizationId,
          correlationId,
        })
      ).rejects.toThrowError(attributeNotFound(attribute.id));
    });
    it("Should throw tenantIsNotACertifier if the requester is not a certifier", async () => {
      const requesterTenant: Tenant = getMockTenant();
      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);

      expect(
        tenantService.addCertifiedAttribute(targetTenant.id, {
          tenantAttributeSeed,
          organizationId: getMockAuthData(requesterTenant.id).organizationId,
          correlationId,
        })
      ).rejects.toThrowError(tenantIsNotACertifier(requesterTenant.id));
    });
    it("Should throw certifiedAttributeOriginIsNotCompliantWithCertifier if attribute origin doesn't match the certifierId of the requester", async () => {
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
          organizationId,
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
  });
