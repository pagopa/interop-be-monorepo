/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  toTenantV2,
  Descriptor,
  EService,
  descriptorState,
  tenantAttributeType,
  AttributeId,
  TenantVerifiedAttributeRevokedV2,
  Agreement,
  toReadModelEService,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  writeInReadmodel,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  tenantNotFound,
  attributeAlreadyRevoked,
  attributeNotFound,
  attributeRevocationNotAllowed,
  verifiedAttributeSelfRevocation,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  getMockAgreement,
  getMockTenant,
  getMockEService,
  getMockDescriptor,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  getMockRevokedBy,
  eservices,
  agreements,
  tenantService,
  postgresDB,
} from "./utils.js";

describe("revokeVerifiedAttribute", async () => {
  const targetTenant: Tenant = getMockTenant();
  const requesterTenant: Tenant = getMockTenant();
  const attributeId: AttributeId = generateId();
  const descriptor1: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    attributes: {
      verified: [
        [
          {
            id: attributeId,
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

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should revoke the VerifiedAttribute if it exist", async () => {
    const mockVerifiedBy = getMockVerifiedBy();
    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: unsafeBrandId(attributeId),
          verifiedBy: [
            {
              ...mockVerifiedBy,
              id: requesterTenant.id,
            },
          ],
          revokedBy: [],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );

    const returnedTenant = await tenantService.revokeVerifiedAttribute(
      {
        tenantId: tenantWithVerifiedAttribute.id,
        attributeId,
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
      type: "TenantVerifiedAttributeRevoked",
      event_version: 2,
    });

    const writtenPayload = protobufDecoder(
      TenantVerifiedAttributeRevokedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithVerifiedAttribute,
      attributes: [
        {
          id: unsafeBrandId(attributeId),
          type: tenantAttributeType.VERIFIED,
          assignmentTimestamp: new Date(),
          verifiedBy: [],
          revokedBy: [
            {
              id: requesterTenant.id,
              verificationDate: mockVerifiedBy.verificationDate,
              revocationDate: new Date(),
            },
          ],
        },
      ],
      updatedAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );
    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          attributeId,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(targetTenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const tenantWithoutSameAttributeId: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: generateId(),
          verifiedBy: [
            {
              ...getMockVerifiedBy(),
              id: requesterTenant.id,
            },
          ],
          revokedBy: [{ ...getMockRevokedBy() }],
        },
      ],
    };

    await addOneTenant(tenantWithoutSameAttributeId);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );
    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithoutSameAttributeId.id,
          attributeId,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(attributeNotFound(attributeId));
  });
  it("Should throw attributeRevocationNotAllowed if the organization is not allowed to revoke the attribute", async () => {
    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: unsafeBrandId(attributeId),
          verifiedBy: [
            {
              ...getMockVerifiedBy(),
              id: generateId(),
            },
          ],
          revokedBy: [{ ...getMockRevokedBy() }],
        },
      ],
    };

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeRevocationNotAllowed(targetTenant.id, unsafeBrandId(attributeId))
    );
  });
  it("Should throw verifiedAttributeSelfRevocation if the organizations are not allowed to revoke own attributes", async () => {
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: requesterTenant.id,
          attributeId,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(verifiedAttributeSelfRevocation());
  });
  it("Should throw attributeAlreadyRevoked if the attribute is already revoked", async () => {
    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: unsafeBrandId(attributeId),
          verifiedBy: [
            {
              ...getMockVerifiedBy(),
              id: requesterTenant.id,
            },
          ],
          revokedBy: [{ ...getMockRevokedBy(), id: requesterTenant.id }],
        },
      ],
    };

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeAlreadyRevoked(
        targetTenant.id,
        requesterTenant.id,
        unsafeBrandId(attributeId)
      )
    );
  });
});
