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
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  TenantCertifiedAttributeRevokedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  tenantNotFound,
  attributeNotFound,
  tenantIsNotACertifier,
  certifiedAttributeOriginIsNotCompliantWithCertifier,
  attributeAlreadyRevoked,
} from "../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  getMockTenant,
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
    const targetTenant: Tenant = getMockTenant();
    let requesterTenant: Tenant;
    let attribute: Attribute;

    beforeAll(async () => {
      requesterTenant = {
        ...getMockTenant(),
        features: [
          {
            type: "PersistentCertifier",
            certifierId: generateId(),
          },
        ],
      };

      attribute = {
        ...getMockAttribute(),
        kind: attributeKind.certified,
        origin: requesterTenant.features[0].certifierId,
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("Should revoke the certified attribute if it exist", async () => {
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
        requesterTenant.id,
        generateId(),
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
        type: "TenantCertifiedAttributeRevoked",
        event_version: 2,
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
    });
    it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
      await addOneAttribute(attribute, attributes);
      expect(
        tenantService.revokeCertifiedAttributeById(
          targetTenant.id,
          attribute.id,
          requesterTenant.id,
          generateId(),
          genericLogger
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
          requesterTenant.id,
          generateId(),
          genericLogger
        )
      ).rejects.toThrowError(attributeNotFound(attribute.id));
    });
    it("Should throw tenantIsNotACertifier if the requester is not a certifier", async () => {
      const notCertifierTenant: Tenant = {
        ...getMockTenant(),
      };

      await addOneAttribute(attribute, attributes);
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(notCertifierTenant, postgresDB, tenants);

      expect(
        tenantService.revokeCertifiedAttributeById(
          targetTenant.id,
          attribute.id,
          notCertifierTenant.id,
          generateId(),
          genericLogger
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
          requesterTenant.id,
          generateId(),
          genericLogger
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
          requesterTenant.id,
          generateId(),
          genericLogger
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
