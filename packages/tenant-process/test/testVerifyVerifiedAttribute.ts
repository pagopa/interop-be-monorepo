/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAttribute,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  toTenantV2,
  Descriptor,
  EService,
  TenantVerifiedAttributeAssignedV2,
  descriptorState,
  tenantAttributeType,
  Attribute,
  attributeKind,
  Agreement,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  tenantNotFound,
  attributeVerificationNotAllowed,
  verifiedAttributeSelfVerification,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import { ApiVerifiedTenantAttributeSeed } from "../src/model/types.js";
import {
  addOneTenant,
  addOneAgreement,
  addOneEService,
  getMockAgreement,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  getMockRevokedBy,
  addOneAttribute,
} from "./utils.js";
import {
  agreements,
  eservices,
  postgresDB,
  tenants,
  tenantService,
  attributes,
} from "./tenant.integration.test.js";

export const testVerifyVerifiedAttribute = (): ReturnType<typeof describe> =>
  describe("verifyVerifiedAttribute", async () => {
    const targetTenant = getMockTenant();
    const requesterTenant = getMockTenant();
    let tenantAttributeSeed: ApiVerifiedTenantAttributeSeed;
    let attribute: Attribute;
    let descriptor1: Descriptor;
    let eService1: EService;
    let agreementEservice1: Agreement;

    beforeAll(async () => {
      tenantAttributeSeed = {
        id: generateId(),
      };

      attribute = {
        ...getMockAttribute(),
        id: unsafeBrandId(tenantAttributeSeed.id),
        kind: attributeKind.verified,
      };

      descriptor1 = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        attributes: {
          verified: [
            [
              {
                id: unsafeBrandId(tenantAttributeSeed.id),
                explicitAttributeVerification: false,
              },
            ],
          ],
          declared: [],
          certified: [],
        },
      };

      eService1 = {
        ...getMockEService(),
        producerId: requesterTenant.id,
        descriptors: [descriptor1],
      };

      agreementEservice1 = getMockAgreement({
        eserviceId: eService1.id,
        descriptorId: descriptor1.id,
        producerId: eService1.producerId,
        consumerId: targetTenant.id,
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("Should verify the VerifiedAttribute if verifiedTenantAttribute doesn't exist", async () => {
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneAttribute(attribute, attributes);
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);
      await tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
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
        type: "TenantVerifiedAttributeAssigned",
        event_version: 2,
      });
      const writtenPayload = protobufDecoder(
        TenantVerifiedAttributeAssignedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...targetTenant,
        attributes: [
          {
            id: unsafeBrandId(tenantAttributeSeed.id),
            type: tenantAttributeType.VERIFIED,
            assignmentTimestamp: new Date(),
            verifiedBy: [
              {
                id: requesterTenant.id,
                verificationDate: new Date(),
                expirationDate: tenantAttributeSeed.expirationDate
                  ? new Date(tenantAttributeSeed.expirationDate)
                  : undefined,
                extensionDate: tenantAttributeSeed.expirationDate
                  ? new Date(tenantAttributeSeed.expirationDate)
                  : undefined,
              },
            ],
            revokedBy: [],
          },
        ],
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    });
    it("Should verify the VerifiedAttribute if verifiedTenantAttribute exist", async () => {
      const mockVerifiedBy = getMockVerifiedBy();
      const mockRevokedBy = getMockRevokedBy();

      const tenantWithVerifiedAttribute: Tenant = {
        ...targetTenant,
        attributes: [
          {
            ...getMockVerifiedTenantAttribute(),
            id: attribute.id,
            verifiedBy: [
              {
                ...mockVerifiedBy,
              },
            ],
            revokedBy: [{ ...mockRevokedBy }],
          },
        ],
      };

      await addOneTenant(tenantWithVerifiedAttribute, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneAttribute(attribute, attributes);
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);

      await tenantService.verifyVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      );
      const writtenEvent = await readLastEventByStreamId(
        tenantWithVerifiedAttribute.id,
        "tenant",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: tenantWithVerifiedAttribute.id,
        version: "1",
        type: "TenantVerifiedAttributeAssigned",
        event_version: 2,
      });
      const writtenPayload = protobufDecoder(
        TenantVerifiedAttributeAssignedV2
      ).parse(writtenEvent?.data);

      const updatedTenant: Tenant = {
        ...tenantWithVerifiedAttribute,
        attributes: [
          {
            id: attribute.id,
            type: "PersistentVerifiedAttribute",
            assignmentTimestamp: new Date(),
            verifiedBy: [
              { ...mockVerifiedBy },
              {
                ...mockVerifiedBy,
                id: requesterTenant.id,
                verificationDate: new Date(),
              },
            ],
            revokedBy: [{ ...mockRevokedBy }],
          },
        ],
        updatedAt: new Date(),
      };

      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    });
    it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);
      expect(
        tenantService.verifyVerifiedAttribute(
          {
            tenantId: targetTenant.id,
            tenantAttributeSeed,
            organizationId: requesterTenant.id,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(tenantNotFound(targetTenant.id));
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);
      expect(
        tenantService.verifyVerifiedAttribute(
          {
            tenantId: targetTenant.id,
            tenantAttributeSeed,
            organizationId: requesterTenant.id,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(attributeNotFound(attribute.id));
    });
    it("Should throw attributeVerificationNotAllowed if the organization is not allowed to verify the attribute", async () => {
      const descriptorAttributeVerificationNotAllowed: Descriptor = {
        ...descriptor1,
        attributes: {
          verified: [
            [
              {
                id: generateId(),
                explicitAttributeVerification: false,
              },
            ],
          ],
          declared: [],
          certified: [],
        },
      };

      const eServiceWithNotAllowedDescriptor: EService = {
        ...eService1,
        descriptors: [descriptorAttributeVerificationNotAllowed],
      };

      const agreementEserviceWithNotAllowedDescriptor = getMockAgreement({
        ...agreementEservice1,
        eserviceId: eServiceWithNotAllowedDescriptor.id,
        descriptorId: descriptorAttributeVerificationNotAllowed.id,
      });

      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneEService(eServiceWithNotAllowedDescriptor, eservices);
      await addOneAgreement(
        agreementEserviceWithNotAllowedDescriptor,
        agreements
      );

      expect(
        tenantService.verifyVerifiedAttribute(
          {
            tenantId: targetTenant.id,
            tenantAttributeSeed,
            organizationId: requesterTenant.id,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(
        attributeVerificationNotAllowed(
          targetTenant.id,
          unsafeBrandId(tenantAttributeSeed.id)
        )
      );
    });
    it("Should throw verifiedAttributeSelfVerification if the organizations are not allowed to revoke own attributes", async () => {
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);

      expect(
        tenantService.verifyVerifiedAttribute(
          {
            tenantId: targetTenant.id,
            tenantAttributeSeed,
            organizationId: targetTenant.id,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(verifiedAttributeSelfVerification());
    });
  });
