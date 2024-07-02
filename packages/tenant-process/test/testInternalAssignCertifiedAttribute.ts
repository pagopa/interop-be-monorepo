/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { attributeKind } from "pagopa-interop-models";

import {
  getMockAttribute,
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
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantFromExternalIdNotFound,
} from "../src/model/domain/errors.js";
import { addOneAttribute, addOneTenant, getMockTenant } from "./utils.js";
import {
  postgresDB,
  attributes,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";

export const testInternalAssignCertifiedAttribute = (): ReturnType<
  typeof describe
> =>
  describe("internalAssignCertifiedAttributes", async () => {
    let attribute: Attribute;

    beforeAll(async () => {
      attribute = {
        ...getMockAttribute(),
        kind: attributeKind.certified,
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("Should add the certified attribute if the Tenant doesn't have it", async () => {
      const targetTenant: Tenant = {
        ...getMockTenant(),
        attributes: [],
      };
      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeOrigin: attribute.origin!,
          attributeExternalId: attribute.code!,
          correlationId: generateId(),
        },
        genericLogger
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
            id: unsafeBrandId(attribute.id),
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
        kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    });
    it("Should re-assign the attribute if it was revoked", async () => {
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
        {
          tenantOrigin: tenantWithCertifiedAttribute.externalId.origin,
          tenantExternalId: tenantWithCertifiedAttribute.externalId.value,
          attributeOrigin: attribute.origin!,
          attributeExternalId: attribute.code!,
          correlationId: generateId(),
        },
        genericLogger
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
            id: unsafeBrandId(attribute.id),
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
          {
            tenantOrigin: tenantAlreadyAssigned.externalId.origin,
            tenantExternalId: tenantAlreadyAssigned.externalId.value,
            attributeOrigin: attribute.origin!,
            attributeExternalId: attribute.code!,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(
        certifiedAttributeAlreadyAssigned(
          unsafeBrandId(attribute.id),
          unsafeBrandId(tenantAlreadyAssigned.id)
        )
      );
    });
    it("Should throw tenantNotFound if the target tenant doesn't exist", async () => {
      await addOneAttribute(attribute, attributes);
      const targetTenant = getMockTenant();
      expect(
        tenantService.internalAssignCertifiedAttribute(
          {
            tenantOrigin: targetTenant.externalId.origin,
            tenantExternalId: targetTenant.externalId.value,
            attributeOrigin: attribute.origin!,
            attributeExternalId: attribute.code!,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(
        tenantFromExternalIdNotFound(
          targetTenant.externalId.origin,
          targetTenant.externalId.value
        )
      );
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      const targetTenant: Tenant = getMockTenant();
      await addOneTenant(targetTenant, postgresDB, tenants);

      expect(
        tenantService.internalAssignCertifiedAttribute(
          {
            tenantOrigin: targetTenant.externalId.origin,
            tenantExternalId: targetTenant.externalId.value,
            attributeOrigin: attribute.origin!,
            attributeExternalId: attribute.code!,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(
        attributeNotFound(
          unsafeBrandId(`${attribute.origin}/${attribute.code}`)
        )
      );
    });
  });
