/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  AttributeId,
  TenantDeclaredAttributeRevokedV2,
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
  currentDate,
} from "./utils.js";
import {
  postgresDB,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";

export const testRevokeDeclaredAttribute = (): ReturnType<typeof describe> =>
  describe("revokeDeclaredAttribute", async () => {
    const attributeId: AttributeId = generateId();

    const tenant: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: attributeId,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(
            currentDate.setDate(currentDate.getDate() - 3)
          ),
        },
      ],
      updatedAt: new Date(),
    };

    const organizationId = getMockAuthData(tenant.id).organizationId;

    it("Should revoke the declared attribute if it exist in tenant", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      await addOneTenant(tenant, postgresDB, tenants);
      await tenantService.revokeDeclaredAttribute({
        attributeId,
        organizationId,
        correlationId: generateId(),
      });
      const writtenEvent = await readLastEventByStreamId(
        tenant.id,
        "tenant",
        postgresDB
      );
      if (!writtenEvent) {
        fail("Update failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: tenant.id,
        version: "1",
        type: "TenantDeclaredAttributeRevoked",
      });
      const writtenPayload = protobufDecoder(
        TenantDeclaredAttributeRevokedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...tenant,
        attributes: [
          {
            ...tenant.attributes[0],
            type: "PersistentDeclaredAttribute",
            revocationTimestamp: new Date(),
          },
        ],
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      vi.useRealTimers();
    });
    it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
      expect(
        tenantService.revokeDeclaredAttribute({
          attributeId,
          organizationId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(tenantNotFound(tenant.id));
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      const notDeclaredAttributeTenant: Tenant = {
        ...tenant,
        attributes: [
          {
            id: attributeId,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(notDeclaredAttributeTenant, postgresDB, tenants);
      const notDeclaredorganizationId = getMockAuthData(
        notDeclaredAttributeTenant.id
      ).organizationId;

      expect(
        tenantService.revokeDeclaredAttribute({
          attributeId,
          organizationId: notDeclaredorganizationId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(attributeNotFound(attributeId));
    });
  });
