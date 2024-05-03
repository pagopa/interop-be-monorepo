/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  Attribute,
  TenantCertifiedAttributeAssignedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";
import {
  tenantNotFound,
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  getMockTenant,
  addOneAttribute,
  getMockAttribute,
} from "./utils.js";
import {
  attributes,
  postgresDB,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";

export const testInternalAssignCertifiedAttribute = (): ReturnType<
  typeof describe
> =>
  describe("internalAssignCertifiedAttribute", async () => {
    const correlationId = generateId();
    const attribute: Attribute = {
      ...getMockAttribute(),
      kind: "Certified",
    };

    it("Should add the certified attribute if the Tenant doesn't have that", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      const targetTenant: Tenant = {
        ...getMockTenant(),
        attributes: [],
        externalId: {
          origin: generateId(),
          value: "123456",
        },
      };
      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await tenantService.internalAssignCertifiedAttribute(
        targetTenant.externalId.origin,
        targetTenant.externalId.value,
        attribute.origin!,
        attribute.code!,
        correlationId
      );
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
            id: unsafeBrandId(attribute.id),
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
    it("Should re-assign the attribute if it was revoked", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      const tenantWithCertifiedAttribute: Tenant = {
        ...getMockTenant(),
        attributes: [
          {
            id: unsafeBrandId(attribute.id),
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
            revocationTimestamp: new Date(),
          },
        ],
      };

      await addOneAttribute(attribute, attributes);
      await addOneTenant(tenantWithCertifiedAttribute, postgresDB, tenants);
      await tenantService.internalAssignCertifiedAttribute(
        tenantWithCertifiedAttribute.externalId.origin,
        tenantWithCertifiedAttribute.externalId.value,
        attribute.origin!,
        attribute.code!,
        correlationId
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
            id: unsafeBrandId(attribute.id),
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
    it("Should throw certifiedAttributeAlreadyAssigned", async () => {
      const tenantAlreadyAssigned: Tenant = {
        ...getMockTenant(),
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
      expect(
        tenantService.internalAssignCertifiedAttribute(
          tenantAlreadyAssigned.externalId.origin,
          tenantAlreadyAssigned.externalId.value,
          attribute.origin!,
          attribute.code!,
          correlationId
        )
      ).rejects.toThrowError(
        certifiedAttributeAlreadyAssigned(
          unsafeBrandId(attribute.id),
          unsafeBrandId(tenantAlreadyAssigned.id)
        )
      );
    });
    it("Should throw tenant not found", async () => {
      await addOneAttribute(attribute, attributes);
      const targetTenant: Tenant = getMockTenant();
      expect(
        tenantService.internalAssignCertifiedAttribute(
          targetTenant.externalId.origin,
          targetTenant.externalId.value,
          attribute.origin!,
          attribute.code!,
          correlationId
        )
      ).rejects.toThrowError(
        tenantNotFound(
          unsafeBrandId(
            `${targetTenant.externalId.origin}/${targetTenant.externalId.value}`
          )
        )
      );
    });
    it("Should throw attribute not found", async () => {
      const targetTenant: Tenant = getMockTenant();
      await addOneTenant(targetTenant, postgresDB, tenants);

      expect(
        tenantService.internalAssignCertifiedAttribute(
          targetTenant.externalId.origin,
          targetTenant.externalId.value,
          attribute.origin!,
          attribute.code!,
          correlationId
        )
      ).rejects.toThrowError(
        attributeNotFound(
          unsafeBrandId(`${attribute.origin}/${attribute.code}`)
        )
      );
    });
  });
