import { fail } from "assert";
import { attributeKind } from "pagopa-interop-models";
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { readLastEventByStreamId } from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  Tenant,
  Attribute,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  TenantCertifiedAttributeRevokedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";
import {
  tenantNotFound,
  attributeNotFound,
  tenantIsNotACertifier,
  certifiedAttributeOriginIsNotCompliantWithCertifier,
  attributeAlreadyRevoked,
} from "../src/model/domain/errors.js";
import {
  getMockAuthData,
  addOneAttribute,
  addOneTenant,
  getMockTenant,
  getMockAttribute,
  getMockCertifiedTenantAttribute,
} from "./utils.js";
import {
  postgresDB,
  attributes,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";

export const testRevokeCertifiedAttributeById = (): ReturnType<
  typeof describe
> =>
  describe("revokeCertifiedAttributeById", async () => {
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "PersistentCertifier",
          certifierId: generateId(),
        },
      ],
    };

    const attribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
      origin: requesterTenant.features[0].certifierId,
    };

    const targetTenant: Tenant = getMockTenant();
    const organizationId = getMockAuthData(requesterTenant.id).organizationId;

    it("Should revoke the certified attribute if it exist", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      const tenantWithCertifiedAttribute: Tenant = {
        ...targetTenant,
        attributes: [
          {
            ...getMockCertifiedTenantAttribute(),
            id: attribute.id,
            assignmentTimestamp: new Date(),
          },
        ],
      };

      await addOneAttribute(attribute, attributes);
      await addOneTenant(tenantWithCertifiedAttribute, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await tenantService.revokeCertifiedAttributeById(
        tenantWithCertifiedAttribute.id,
        attribute.id,
        organizationId,
        generateId()
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
            id: attribute.id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
            revocationTimestamp: new Date(),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      vi.useRealTimers();
    });
    it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
      await addOneAttribute(attribute, attributes);
      expect(
        tenantService.revokeCertifiedAttributeById(
          targetTenant.id,
          attribute.id,
          organizationId,
          generateId()
        )
      ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);

      expect(
        tenantService.revokeCertifiedAttributeById(
          targetTenant.id,
          attribute.id,
          organizationId,
          generateId()
        )
      ).rejects.toThrowError(attributeNotFound(attribute.id));
    });
    it("Should throw tenantIsNotACertifier if the requester is not a certifier", async () => {
      const notCertifierTenant: Tenant = {
        ...getMockTenant(),
      };
      const organizationId = getMockAuthData(
        notCertifierTenant.id
      ).organizationId;
      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(notCertifierTenant, postgresDB, tenants);

      expect(
        tenantService.revokeCertifiedAttributeById(
          targetTenant.id,
          attribute.id,
          organizationId,
          generateId()
        )
      ).rejects.toThrowError(tenantIsNotACertifier(notCertifierTenant.id));
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
        tenantService.revokeCertifiedAttributeById(
          targetTenant.id,
          attribute.id,
          organizationId,
          generateId()
        )
      ).rejects.toThrowError(
        certifiedAttributeOriginIsNotCompliantWithCertifier(
          notCompliantOriginAttribute.origin!,
          requesterTenant.id,
          targetTenant.id,
          requesterTenant.features[0].certifierId
        )
      );
    });
    it("Should throw attributeAlreadyRevoked if the attribute was already assigned revoked", async () => {
      const tenantAlreadyRevoked: Tenant = {
        ...targetTenant,
        attributes: [
          {
            ...getMockCertifiedTenantAttribute(),
            id: attribute.id,
            revocationTimestamp: new Date(),
          },
        ],
      };
      await addOneAttribute(attribute, attributes);
      await addOneTenant(tenantAlreadyRevoked, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      expect(
        tenantService.revokeCertifiedAttributeById(
          tenantAlreadyRevoked.id,
          attribute.id,
          organizationId,
          generateId()
        )
      ).rejects.toThrowError(
        attributeAlreadyRevoked(
          tenantAlreadyRevoked.id,
          requesterTenant.id,
          attribute.id
        )
      );
    });
  });
