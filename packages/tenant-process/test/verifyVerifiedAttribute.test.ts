/* eslint-disable @typescript-eslint/no-floating-promises */
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
  delegationState,
  delegationKind,
  AttributeId,
  toReadModelAgreement,
  toReadModelAttribute,
  toReadModelEService,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAttribute,
  readLastEventByStreamId,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  getMockDelegation,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  tenantNotFound,
  attributeVerificationNotAllowed,
  verifiedAttributeSelfVerificationNotAllowed,
  attributeNotFound,
  expirationDateCannotBeInThePast,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  getMockAgreement,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  getMockRevokedBy,
  tenantService,
  postgresDB,
  addOneAgreement,
  addOneAttribute,
  addOneEService,
  addOneDelegation,
  agreements,
  attributes,
  eservices,
} from "./utils.js";

describe("verifyVerifiedAttribute", async () => {
  const targetTenant = getMockTenant();
  const requesterTenant = getMockTenant();

  const tenantAttributeSeedId = generateId<AttributeId>();

  const attribute: Attribute = {
    ...getMockAttribute(),
    id: unsafeBrandId(tenantAttributeSeedId),
    kind: attributeKind.verified,
  };
  const descriptor1: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    attributes: {
      verified: [
        [
          {
            id: unsafeBrandId(tenantAttributeSeedId),
            explicitAttributeVerification: false,
          },
        ],
      ],
      declared: [],
      certified: [],
    },
  };
  const eService1: EService = {
    ...getMockEService(),
    producerId: requesterTenant.id,
    descriptors: [descriptor1],
  };
  const agreementEservice1: Agreement = getMockAgreement({
    eserviceId: eService1.id,
    descriptorId: descriptor1.id,
    producerId: eService1.producerId,
    consumerId: targetTenant.id,
  });

  const delegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
    eserviceId: eService1.id,
    delegateId: requesterTenant.id,
    state: delegationState.active,
  });

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it.each([
    {
      desc: "without delegation",
      hasDelegation: false,
    },
    {
      desc: "with delegation",
      hasDelegation: true,
    },
  ])(
    "Should verify the VerifiedAttribute if verifiedTenantAttribute doesn't exist $desc",
    async ({ hasDelegation }) => {
      await addOneTenant(targetTenant);
      await addOneTenant(requesterTenant);
      await addOneAttribute(attribute);
      await addOneEService(eService1);
      await addOneAgreement(agreementEservice1);
      if (hasDelegation) {
        await addOneDelegation(delegation);
      }

      const returnedTenant = await tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          attributeId: tenantAttributeSeedId,
          agreementId: agreementEservice1.id,
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
            id: tenantAttributeSeedId,
            type: tenantAttributeType.VERIFIED,
            assignmentTimestamp: new Date(),
            verifiedBy: [
              {
                id: eService1.producerId,
                delegationId: hasDelegation ? delegation.id : undefined,
                verificationDate: new Date(),
                expirationDate: undefined,
                extensionDate: undefined,
              },
            ],
            revokedBy: [],
          },
        ],
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      expect(returnedTenant).toEqual(updatedTenant);
    }
  );

  it.each([
    {
      desc: "without delegation",
      hasDelegation: false,
    },
    {
      desc: "with delegation",
      hasDelegation: true,
    },
  ])(
    "Should verify the VerifiedAttribute if verifiedTenantAttribute exist $desc",
    async (hasDelegation) => {
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

      await addOneTenant(tenantWithVerifiedAttribute);
      await addOneTenant(requesterTenant);
      await addOneAttribute(attribute);
      await addOneEService(eService1);
      await addOneAgreement(agreementEservice1);
      if (hasDelegation) {
        await addOneDelegation(delegation);
      }

      const returnedTenant = await tenantService.verifyVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId: tenantAttributeSeedId,
          agreementId: agreementEservice1.id,
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
                id: eService1.producerId,
                delegationId: hasDelegation ? delegation.id : undefined,
                verificationDate: new Date(),
              },
            ],
            revokedBy: [{ ...mockRevokedBy }],
          },
        ],
        updatedAt: new Date(),
      };

      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      expect(returnedTenant).toEqual(updatedTenant);
    }
  );
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await addOneEService(eService1);
    await addOneAgreement(agreementEservice1);

    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          attributeId: tenantAttributeSeedId,
          agreementId: agreementEservice1.id,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(targetTenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);
    await addOneEService(eService1);
    await addOneAgreement(agreementEservice1);

    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          attributeId: tenantAttributeSeedId,
          agreementId: agreementEservice1.id,
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

    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);
    await addOneEService(eServiceWithNotAllowedDescriptor);
    await addOneAgreement(agreementEserviceWithNotAllowedDescriptor);

    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          attributeId: tenantAttributeSeedId,
          agreementId: agreementEserviceWithNotAllowedDescriptor.id,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeVerificationNotAllowed(
        targetTenant.id,
        unsafeBrandId(tenantAttributeSeedId)
      )
    );
  });
  it("Should throw verifiedAttributeSelfVerificationNotAllowed if the organizations are not allowed to revoke own attributes", async () => {
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);
    await addOneEService(eService1);
    await addOneAgreement(agreementEservice1);

    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: agreementEservice1.producerId,
          attributeId: tenantAttributeSeedId,
          agreementId: agreementEservice1.id,
          organizationId: agreementEservice1.producerId,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(verifiedAttributeSelfVerificationNotAllowed());
  });
  it("Should throw expirationDateCannotBeInThePast if the expirationDate is in the past", async () => {
    const mockVerifiedBy = getMockVerifiedBy();
    const mockRevokedBy = getMockRevokedBy();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

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

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(requesterTenant);
    await addOneAgreement(agreementEservice1);
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );

    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          attributeId: tenantAttributeSeedId,
          agreementId: agreementEservice1.id,
          expirationDate: yesterday.toISOString(),
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(expirationDateCannotBeInThePast(yesterday));
  });
});
