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
  TenantDeclaredAttributeAssignedV2,
  TenantDeclaredAttributeV2,
  Attribute,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  tenantNotFound,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import { ApiDeclaredTenantAttributeSeed } from "../src/model/types.js";
import {
  currentDate,
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

export const testAddDeclaredAttributes = (): ReturnType<typeof describe> =>
  describe("addDeclaredAttribute", async () => {
    const tenantAttributeSeed: ApiDeclaredTenantAttributeSeed = {
      id: generateId(),
    };
    const correlationId = generateId();
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: unsafeBrandId(tenantAttributeSeed.id),
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
        },
      ],
      updatedAt: currentDate,
      name: "A requesterTenant",
    };

    const declaredAttribute: Attribute = {
      ...getMockAttribute(),
      id: unsafeBrandId(tenantAttributeSeed.id),
    };

    const mockAuthData = getMockAuthData(requesterTenant.id);

    it("Should add the declared attribute if it doesn't already exist", async () => {
      const tenantWithoutDeclaredAttribute: Tenant = {
        ...requesterTenant,
        attributes: [],
      };

      await addOneAttribute(declaredAttribute, attributes);
      await addOneTenant(tenantWithoutDeclaredAttribute, postgresDB, tenants);
      await tenantService.addDeclaredAttribute({
        tenantAttributeSeed,
        authData: mockAuthData,
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
            id: unsafeBrandId(tenantAttributeSeed.id),
            type: "PersistentDeclaredAttribute",
            assignmentTimestamp: new Date(
              Number(
                (
                  writtenPayload.tenant!.attributes[0].sealedValue as {
                    oneofKind: "declaredAttribute";
                    declaredAttribute: TenantDeclaredAttributeV2;
                  }
                ).declaredAttribute.assignmentTimestamp
              )
            ),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    });
    it("Should add the declared attribute if declared Tenant Attribute exist", async () => {
      await addOneAttribute(declaredAttribute, attributes);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await tenantService.addDeclaredAttribute({
        tenantAttributeSeed,
        authData: mockAuthData,
        correlationId,
      });
      const writtenEvent = await readLastEventByStreamId(
        requesterTenant.id,
        "tenant",
        postgresDB
      );
      if (!writtenEvent) {
        fail("Update failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: requesterTenant.id,
        version: "1",
        type: "TenantDeclaredAttributeAssigned",
      });
      const writtenPayload = protobufDecoder(
        TenantDeclaredAttributeAssignedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...requesterTenant,
        attributes: [
          {
            id: unsafeBrandId(tenantAttributeSeed.id),
            type: "PersistentDeclaredAttribute",
            assignmentTimestamp: new Date(
              Number(
                (
                  writtenPayload.tenant!.attributes[0].sealedValue as {
                    oneofKind: "declaredAttribute";
                    declaredAttribute: TenantDeclaredAttributeV2;
                  }
                ).declaredAttribute.assignmentTimestamp
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
      expect(
        tenantService.addDeclaredAttribute({
          tenantAttributeSeed,
          authData: mockAuthData,
          correlationId,
        })
      ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
    });
    it("Should throw AttributeNotFound", async () => {
      const notDeclaredAttributeTenant: Tenant = {
        ...requesterTenant,
        attributes: [
          {
            id: unsafeBrandId(tenantAttributeSeed.id),
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(notDeclaredAttributeTenant, postgresDB, tenants);
      const authData = getMockAuthData(notDeclaredAttributeTenant.id);

      expect(
        tenantService.addDeclaredAttribute({
          tenantAttributeSeed,
          authData,
          correlationId,
        })
      ).rejects.toThrowError(
        attributeNotFound(unsafeBrandId(tenantAttributeSeed.id))
      );
    });
  });
