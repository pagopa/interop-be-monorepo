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
  TenantCertifiedAttributeRevokedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";
import {
  tenantNotFound,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  getMockTenant,
  addOneAttribute,
  getMockAttribute,
  getMockCertifiedTenantAttribute,
} from "./utils.js";
import {
  attributes,
  postgresDB,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";

export const testInternalRevokeCertifiedAttributes = (): ReturnType<
  typeof describe
> =>
  describe("testInternalRevokeCertifiedAttributes", async () => {
    const correlationId = generateId();
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "PersistentCertifier",
          certifierId: generateId(),
        },
      ],
      externalId: {
        origin: generateId(),
        value: "1234567",
      },
    };

    it("Should revoke the certified attribute if it exist", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      const mockAttribute = getMockAttribute();
      const tenantWithCertifiedAttribute: Tenant = {
        ...requesterTenant,
        attributes: [
          {
            ...getMockCertifiedTenantAttribute(),
            id: unsafeBrandId(mockAttribute.id),
            assignmentTimestamp: new Date(),
          },
        ],
      };

      await addOneAttribute(mockAttribute, attributes);
      await addOneTenant(tenantWithCertifiedAttribute, postgresDB, tenants);
      await tenantService.internalRevokeCertifiedAttribute(
        tenantWithCertifiedAttribute.externalId.origin,
        tenantWithCertifiedAttribute.externalId.value,
        mockAttribute.origin!,
        mockAttribute.code!,
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
        type: "TenantCertifiedAttributeRevoked",
      });
      const writtenPayload = protobufDecoder(
        TenantCertifiedAttributeRevokedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...tenantWithCertifiedAttribute,
        attributes: [
          {
            id: unsafeBrandId(mockAttribute.id),
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
            revocationTimestamp: new Date(),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      vi.useRealTimers();
    });
    it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
      const mockAttribute = getMockAttribute();
      await addOneAttribute(mockAttribute, attributes);
      expect(
        tenantService.internalRevokeCertifiedAttribute(
          requesterTenant.externalId.origin,
          requesterTenant.externalId.value,
          mockAttribute.origin!,
          mockAttribute.code!,
          correlationId
        )
      ).rejects.toThrowError(
        tenantNotFound(
          unsafeBrandId(
            `${requesterTenant.externalId.origin}/${requesterTenant.externalId.value}`
          )
        )
      );
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      const mockAttribute = getMockAttribute();
      await addOneTenant(requesterTenant, postgresDB, tenants);

      expect(
        tenantService.internalRevokeCertifiedAttribute(
          requesterTenant.externalId.origin,
          requesterTenant.externalId.value,
          mockAttribute.origin!,
          mockAttribute.code!,
          correlationId
        )
      ).rejects.toThrowError(
        attributeNotFound(
          unsafeBrandId(`${mockAttribute.origin}/${mockAttribute.code}`)
        )
      );
    });
  });
