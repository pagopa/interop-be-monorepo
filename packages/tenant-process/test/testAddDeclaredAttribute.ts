/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { attributeKind } from "pagopa-interop-models";
import {
  getMockAttribute,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
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
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  tenantNotFound,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import { addOneTenant, addOneAttribute } from "./utils.js";
import {
  attributes,
  postgresDB,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";

export const testAddDeclaredAttribute = (): ReturnType<typeof describe> =>
  describe("addDeclaredAttribute", async () => {
    let declaredAttribute: Attribute;

    beforeAll(async () => {
      declaredAttribute = {
        ...getMockAttribute(),
        kind: attributeKind.declared,
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    const tenant = getMockTenant();

    it("Should add the declared attribute if the tenant doesn't have that", async () => {
      const tenantWithoutDeclaredAttribute: Tenant = {
        ...getMockTenant(),
        attributes: [],
      };

      await addOneAttribute(declaredAttribute, attributes);
      await addOneTenant(tenantWithoutDeclaredAttribute, postgresDB, tenants);
      await tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: { id: declaredAttribute.id },
          organizationId: tenantWithoutDeclaredAttribute.id,
          correlationId: generateId(),
        },
        genericLogger
      );
      const writtenEvent = await readLastEventByStreamId(
        tenantWithoutDeclaredAttribute.id,
        "tenant",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: tenantWithoutDeclaredAttribute.id,
        version: "1",
        type: "TenantDeclaredAttributeAssigned",
        event_version: 2,
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
    });
    it("Should re-assign the declared attribute if it was revoked", async () => {
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
      await tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: { id: declaredAttribute.id },
          organizationId: tenantWithAttributeRevoked.id,
          correlationId: generateId(),
        },
        genericLogger
      );
      const writtenEvent = await readLastEventByStreamId(
        tenantWithAttributeRevoked.id,
        "tenant",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: tenantWithAttributeRevoked.id,
        version: "1",
        type: "TenantDeclaredAttributeAssigned",
        event_version: 2,
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
    });
    it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
      addOneAttribute(declaredAttribute, attributes);
      expect(
        tenantService.addDeclaredAttribute(
          {
            tenantAttributeSeed: { id: declaredAttribute.id },
            organizationId: tenant.id,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(tenantNotFound(tenant.id));
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      await addOneTenant(tenant, postgresDB, tenants);

      expect(
        tenantService.addDeclaredAttribute(
          {
            tenantAttributeSeed: { id: declaredAttribute.id },
            organizationId: tenant.id,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(
        attributeNotFound(unsafeBrandId(declaredAttribute.id))
      );
    });
  });
