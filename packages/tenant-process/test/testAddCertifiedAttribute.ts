import { attributeKind } from "pagopa-interop-models";
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAttribute,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
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
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  tenantNotFound,
  attributeNotFound,
  tenantIsNotACertifier,
  certifiedAttributeOriginIsNotCompliantWithCertifier,
  certifiedAttributeAlreadyAssigned,
} from "../src/model/domain/errors.js";
import { ApiCertifiedTenantAttributeSeed } from "../src/model/types.js";
import {
  addOneAttribute,
  addOneTenant,
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
    let requesterTenant: Tenant;
    let attribute: Attribute;

    const tenantAttributeSeed: ApiCertifiedTenantAttributeSeed = {
      id: generateId(),
    };
    const targetTenant = getMockTenant();

    beforeAll(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      requesterTenant = {
        ...getMockTenant(),
        features: [
          {
            type: "PersistentCertifier",
            certifierId: generateId(),
          },
        ],
        updatedAt: new Date(),
      };

      attribute = {
        ...getMockAttribute(),
        id: unsafeBrandId(tenantAttributeSeed.id),
        kind: attributeKind.certified,
        origin: requesterTenant.features[0].certifierId,
      };
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("Should add the certified attribute if the tenant doesn't have that", async () => {
      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await tenantService.addCertifiedAttribute(
        targetTenant.id,
        genericLogger,
        {
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        }
      );
      const writtenEvent = await readLastEventByStreamId(
        targetTenant.id,
        "tenant",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: targetTenant.id,
        version: "1",
        type: "TenantCertifiedAttributeAssigned",
        event_version: 2,
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
    });
    it("Should re-assign the certified attribute if it was revoked", async () => {
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
        genericLogger,
        {
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        }
      );
      const writtenEvent = await readLastEventByStreamId(
        tenantWithCertifiedAttribute.id,
        "tenant",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: tenantWithCertifiedAttribute.id,
        version: "1",
        type: "TenantCertifiedAttributeAssigned",
        event_version: 2,
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
        tenantService.addCertifiedAttribute(
          tenantAlreadyAssigned.id,
          genericLogger,
          {
            tenantAttributeSeed,
            organizationId: requesterTenant.id,
            correlationId: generateId(),
          }
        )
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
        tenantService.addCertifiedAttribute(targetTenant.id, genericLogger, {
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);

      expect(
        tenantService.addCertifiedAttribute(targetTenant.id, genericLogger, {
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(attributeNotFound(attribute.id));
    });
    it("Should throw tenantIsNotACertifier if the requester is not a certifier", async () => {
      const tenant: Tenant = getMockTenant();
      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(tenant, postgresDB, tenants);

      expect(
        tenantService.addCertifiedAttribute(targetTenant.id, genericLogger, {
          tenantAttributeSeed,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(tenantIsNotACertifier(tenant.id));
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
        tenantService.addCertifiedAttribute(targetTenant.id, genericLogger, {
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
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
