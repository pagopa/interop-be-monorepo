import {
  getMockAttribute,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import {
  Attribute,
  Tenant,
  TenantDeclaredAttributeRevokedV2,
  attributeKind,
  generateId,
  protobufDecoder,
  tenantAttributeType,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { addOneAttribute, addOneTenant, readLastTenantEvent } from "./utils.js";
import {
  attributes,
  postgresDB,
  tenantService,
  tenants,
} from "./tenant.integration.test.js";

export const testM2MRevokeCertifiedAttribute = (): ReturnType<
  typeof describe
> =>
  describe("m2mRevokeCertifiedAttribute", () => {
    it.skip("should write on event-store for the revocation of a certified attribute", async () => {
      const requesterTenant = getMockTenant();
      const mockAttribute: Attribute = {
        ...getMockAttribute(),
        kind: attributeKind.certified,
        origin: requesterTenant.id,
        code: "123456",
      };
      const targetTenant: Tenant = {
        ...getMockTenant(),
        attributes: [
          {
            id: mockAttribute.id,
            type: tenantAttributeType.CERTIFIED,
            assignmentTimestamp: new Date(),
          },
        ],
      };
      await addOneAttribute(mockAttribute, attributes);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneTenant(targetTenant, postgresDB, tenants);

      await tenantService.m2mRevokeCertifiedAttribute({
        organizationId: requesterTenant.id,
        tenantOrigin: targetTenant.externalId.origin,
        tenantExternalId: targetTenant.externalId.value,
        attributeOrigin: requesterTenant.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        attributeExternalId: mockAttribute.code!,
        correlationId: generateId(),
        logger: genericLogger,
      });

      const writtenEvent = await readLastTenantEvent(
        targetTenant.id,
        postgresDB
      );
      expect(writtenEvent).toBeDefined();
      expect(writtenEvent.stream_id).toBe(targetTenant.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("TenantDeclaredAttributeRevoked");

      const writtenPayload = protobufDecoder(
        TenantDeclaredAttributeRevokedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...targetTenant,
        attributes: [
          {
            id: mockAttribute.id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
            revocationTimestamp: new Date(),
          },
        ],
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    });
    it("should throw tenantNotFound if the requester tenant doesn't exist", () => {});
    it("should throw tenantIsNotACertifier if the requester is not a certifier", () => {});
    it("should throw tenantNotFoundByExternalId if the target tenant doesn't exist", () => {});
    it("should throw attributeNotFound if the attribute doesn't exist", () => {});
    it(
      "should throw attributeNotFoundInTenant if the target tenant doesn't have that attribute"
    );
  });
