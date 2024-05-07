import { fail } from "assert";
import { attributeKind } from "pagopa-interop-models";
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { readLastEventByStreamId } from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  TenantDeclaredAttributeAssignedV2,
  Attribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";
import {
  tenantNotFound,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import {
  getMockAuthData,
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

export const testAddDeclaredAttribute = (): ReturnType<typeof describe> =>
  describe("addDeclaredAttribute", async () => {
    const correlationId = generateId();
    const tenant = getMockTenant();
    const organizationId = getMockAuthData(tenant.id).organizationId;

    const declaredAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.declared,
    };

    it("Should add the declared attribute if the tenant doesn't have that", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      const tenantWithoutDeclaredAttribute: Tenant = {
        ...getMockTenant(),
        attributes: [],
      };

      await addOneAttribute(declaredAttribute, attributes);
      await addOneTenant(tenantWithoutDeclaredAttribute, postgresDB, tenants);
      await tenantService.addDeclaredAttribute({
        tenantAttributeSeed: { id: declaredAttribute.id },
        organizationId: getMockAuthData(tenantWithoutDeclaredAttribute.id)
          .organizationId,
        correlationId,
      });
      const writtenEvent = await readLastEventByStreamId(
        tenantWithoutDeclaredAttribute.id,
        "tenant",
        postgresDB
      );
      if (!writtenEvent) {
        fail("Update failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: tenantWithoutDeclaredAttribute.id,
        version: "1",
        type: "TenantDeclaredAttributeAssigned",
      });
      const writtenPayload = protobufDecoder(
        TenantDeclaredAttributeAssignedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...tenantWithoutDeclaredAttribute,
        attributes: [
          {
            id: declaredAttribute.id,
            type: "PersistentDeclaredAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      vi.useRealTimers();
    });
    it("Should re-assign the declared attribute if it was revoked", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      const tenantWithAttributeRevoked: Tenant = {
        ...getMockTenant(),
        attributes: [
          {
            id: declaredAttribute.id,
            type: tenantAttributeType.DECLARED,
            assignmentTimestamp: new Date(),
            revocationTimestamp: new Date(),
          },
        ],
      };
      await addOneAttribute(declaredAttribute, attributes);
      await addOneTenant(tenantWithAttributeRevoked, postgresDB, tenants);
      await tenantService.addDeclaredAttribute({
        tenantAttributeSeed: { id: declaredAttribute.id },
        organizationId: getMockAuthData(tenantWithAttributeRevoked.id)
          .organizationId,
        correlationId,
      });
      const writtenEvent = await readLastEventByStreamId(
        tenantWithAttributeRevoked.id,
        "tenant",
        postgresDB
      );
      if (!writtenEvent) {
        fail("Update failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: tenantWithAttributeRevoked.id,
        version: "1",
        type: "TenantDeclaredAttributeAssigned",
      });
      const writtenPayload = protobufDecoder(
        TenantDeclaredAttributeAssignedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...tenantWithAttributeRevoked,
        attributes: [
          {
            id: declaredAttribute.id,
            type: "PersistentDeclaredAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      vi.useRealTimers();
    });
    it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
      addOneAttribute(declaredAttribute, attributes);
      expect(
        tenantService.addDeclaredAttribute({
          tenantAttributeSeed: { id: declaredAttribute.id },
          organizationId,
          correlationId,
        })
      ).rejects.toThrowError(tenantNotFound(tenant.id));
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      await addOneTenant(tenant, postgresDB, tenants);

      expect(
        tenantService.addDeclaredAttribute({
          tenantAttributeSeed: { id: declaredAttribute.id },
          organizationId,
          correlationId,
        })
      ).rejects.toThrowError(
        attributeNotFound(unsafeBrandId(declaredAttribute.id))
      );
    });
  });
