/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  Descriptor,
  EService,
  descriptorState,
  tenantAttributeType,
  TenantVerifiedAttributeRevokedV2,
  Agreement,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  readLastEventByStreamId,
  getMockAuthData,
  getMockDescriptor,
  getMockTenant,
  getMockEService,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import {
  tenantNotFound,
  attributeAlreadyRevoked,
  attributeNotFound,
  attributeRevocationNotAllowed,
  verifiedAttributeSelfRevocationNotAllowed,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  getMockAgreement,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  getMockRevokedBy,
  tenantService,
  postgresDB,
  addOneEService,
  addOneAgreement,
  addOneDelegation,
} from "./utils.js";

describe("revokeVerifiedAttribute", async () => {
  const targetTenant = getMockTenant();
  const revokerTenant = getMockTenant();
  const authData = getMockAuthData(revokerTenant.id);
  const verifiedAttribute = getMockVerifiedTenantAttribute();
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    attributes: {
      verified: [
        [
          {
            id: verifiedAttribute.id,
            explicitAttributeVerification: false,
          },
        ],
      ],
      declared: [],
      certified: [],
    },
  };
  const eService: EService = {
    ...getMockEService(),
    producerId: revokerTenant.id,
    descriptors: [descriptor],
  };
  const agreementEservice: Agreement = getMockAgreement({
    eserviceId: eService.id,
    descriptorId: descriptor.id,
    producerId: eService.producerId,
    consumerId: targetTenant.id,
  });

  const delegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
    eserviceId: eService.id,
    delegateId: revokerTenant.id,
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
    "Should revoke the VerifiedAttribute if it exist $desc",
    async (hasDelegation) => {
      const mockVerifiedBy = getMockVerifiedBy();
      const tenantWithVerifiedAttribute: Tenant = {
        ...targetTenant,
        attributes: [
          {
            ...verifiedAttribute,
            assignmentTimestamp: new Date(),
            verifiedBy: [
              {
                ...mockVerifiedBy,
                id: revokerTenant.id,
              },
            ],
            revokedBy: [],
          },
        ],
        updatedAt: new Date(),
      };

      await addOneTenant(tenantWithVerifiedAttribute);
      await addOneTenant(revokerTenant);
      await addOneEService(eService);
      await addOneAgreement(agreementEservice);
      if (hasDelegation) {
        await addOneDelegation(delegation);
      }

      const returnedTenant = await tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId: verifiedAttribute.id,
          agreementId: agreementEservice.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
            id: verifiedAttribute.id,
            type: tenantAttributeType.VERIFIED,
            assignmentTimestamp: new Date(),
            verifiedBy: [],
            revokedBy: [
              {
                id: revokerTenant.id,
                delegationId: hasDelegation ? delegation.id : undefined,
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
    }
  );
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await addOneEService(eService);
    await addOneAgreement(agreementEservice);
    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          attributeId: verifiedAttribute.id,
          agreementId: agreementEservice.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantNotFound(targetTenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const tenantWithoutSameAttributeId: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...verifiedAttribute,
          id: generateId(),
          verifiedBy: [{ ...getMockVerifiedBy() }],
          revokedBy: [{ ...getMockRevokedBy() }],
        },
      ],
    };

    await addOneTenant(tenantWithoutSameAttributeId);
    await addOneTenant(revokerTenant);
    await addOneEService(eService);
    await addOneAgreement(agreementEservice);
    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithoutSameAttributeId.id,
          attributeId: verifiedAttribute.id,
          agreementId: agreementEservice.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(attributeNotFound(verifiedAttribute.id));
  });
  it("Should throw attributeRevocationNotAllowed if the organization is not allowed to revoke the attribute", async () => {
    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...verifiedAttribute,
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
    await addOneTenant(revokerTenant);
    await addOneEService(eService);
    await addOneAgreement(agreementEservice);

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId: verifiedAttribute.id,
          agreementId: agreementEservice.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      attributeRevocationNotAllowed(targetTenant.id, verifiedAttribute.id)
    );
  });
  it("Should throw verifiedAttributeSelfRevocationNotAllowed when trying to revoke own attributes", async () => {
    await addOneTenant(revokerTenant);
    await addOneEService(eService);
    await addOneAgreement(agreementEservice);

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: revokerTenant.id,
          attributeId: verifiedAttribute.id,
          agreementId: agreementEservice.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(verifiedAttributeSelfRevocationNotAllowed());
  });
  it("Should throw attributeAlreadyRevoked if the attribute is already revoked", async () => {
    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...verifiedAttribute,
          verifiedBy: [{ ...getMockVerifiedBy(), id: revokerTenant.id }],
          revokedBy: [{ ...getMockRevokedBy(), id: revokerTenant.id }],
        },
      ],
    };

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(revokerTenant);
    await addOneEService(eService);
    await addOneAgreement(agreementEservice);

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId: verifiedAttribute.id,
          agreementId: agreementEservice.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      attributeAlreadyRevoked(
        targetTenant.id,
        revokerTenant.id,
        verifiedAttribute.id
      )
    );
  });
});
