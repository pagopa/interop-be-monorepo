/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  readLastEventByStreamId,
  getMockAuthData,
  getMockDescriptor,
  getMockTenant,
  getMockEService,
  getMockDelegation,
  getMockContext,
} from "pagopa-interop-commons-test";
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
  DelegationId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";

import {
  tenantNotFound,
  attributeAlreadyRevoked,
  attributeNotFound,
  attributeRevocationNotAllowed,
  verifiedAttributeSelfRevocationNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  tenantService,
  postgresDB,
  addOneEService,
  addOneAgreement,
  addOneDelegation,
} from "../integrationUtils.js";
import {
  getMockAgreement,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  getMockRevokedBy,
} from "../mockUtils.js";

describe("revokeVerifiedAttribute", async () => {
  const targetTenant = getMockTenant();
  const revokerTenant = getMockTenant();
  const delegateTenant = getMockTenant();
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
    delegatorId: revokerTenant.id,
    delegateId: delegateTenant.id,
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
    "Should revoke the VerifiedAttribute if it exists $desc",
    async ({ hasDelegation }) => {
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

      await addOneTenant(revokerTenant);
      await addOneTenant(tenantWithVerifiedAttribute);
      await addOneEService(eService);
      await addOneAgreement(agreementEservice);
      if (hasDelegation) {
        await addOneTenant(delegateTenant);
        await addOneDelegation(delegation);
      }

      const revokeVerifiedAttrReturn =
        await tenantService.revokeVerifiedAttribute(
          {
            tenantId: tenantWithVerifiedAttribute.id,
            attributeId: verifiedAttribute.id,
            agreementId: agreementEservice.id,
            delegationId: hasDelegation ? delegation.id : undefined,
          },
          getMockContext({
            authData: hasDelegation
              ? getMockAuthData(delegateTenant.id)
              : authData,
          })
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

      expect(writtenPayload).toEqual({
        tenant: toTenantV2(updatedTenant),
        attributeId: verifiedAttribute.id,
      });
      expect(revokeVerifiedAttrReturn).toEqual({
        data: updatedTenant,
        metadata: { version: 1 },
      });
    }
  );

  it.each([
    { desc: "does not provide", delegationId: undefined },
    { desc: "provides an incorrect", delegationId: generateId<DelegationId>() },
  ])(
    "Should throw attributeRevocationNotAllowed if a producer delegate $desc delegationId",
    async ({ delegationId }) => {
      const delegateTenant = getMockTenant();
      const producerDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: revokerTenant.id,
        delegateId: delegateTenant.id,
        eserviceId: eService.id,
        state: delegationState.active,
      });
      const tenantWithVerifiedAttribute: Tenant = {
        ...targetTenant,
        attributes: [
          {
            ...verifiedAttribute,
            verifiedBy: [
              { ...getMockVerifiedBy(), id: agreementEservice.producerId },
            ],
            revokedBy: [],
          },
        ],
      };

      await addOneTenant(revokerTenant);
      await addOneTenant(delegateTenant);
      await addOneTenant(tenantWithVerifiedAttribute);
      await addOneEService(eService);
      await addOneAgreement(agreementEservice);
      await addOneDelegation(producerDelegation);

      await expect(
        tenantService.revokeVerifiedAttribute(
          {
            tenantId: tenantWithVerifiedAttribute.id,
            attributeId: verifiedAttribute.id,
            agreementId: agreementEservice.id,
            delegationId,
          },
          getMockContext({
            authData: getMockAuthData(delegateTenant.id),
          })
        )
      ).rejects.toThrowError(
        attributeRevocationNotAllowed(targetTenant.id, verifiedAttribute.id)
      );
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
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantNotFound(targetTenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const otherRevoker = getMockTenant();

    const tenantWithoutSameAttributeId: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...verifiedAttribute,
          id: generateId(),
          verifiedBy: [{ id: otherRevoker.id, verificationDate: new Date() }],
          revokedBy: [
            {
              id: otherRevoker.id,
              verificationDate: new Date(),
              revocationDate: new Date(),
            },
          ],
        },
      ],
    };

    await addOneTenant(otherRevoker);
    await addOneTenant(revokerTenant);
    await addOneTenant(tenantWithoutSameAttributeId);
    await addOneEService(eService);
    await addOneAgreement(agreementEservice);
    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithoutSameAttributeId.id,
          attributeId: verifiedAttribute.id,
          agreementId: agreementEservice.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(attributeNotFound(verifiedAttribute.id));
  });
  it("Should throw attributeRevocationNotAllowed if the organization is not allowed to revoke the attribute", async () => {
    const otherVerifier = getMockTenant();
    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...verifiedAttribute,
          verifiedBy: [
            {
              id: otherVerifier.id,
              verificationDate: new Date(),
            },
          ],
        },
      ],
    };

    await addOneTenant(otherVerifier);
    await addOneTenant(revokerTenant);
    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneEService(eService);
    await addOneAgreement(agreementEservice);

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId: verifiedAttribute.id,
          agreementId: agreementEservice.id,
        },
        getMockContext({ authData })
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
        getMockContext({ authData })
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

    await addOneTenant(revokerTenant);
    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneEService(eService);
    await addOneAgreement(agreementEservice);

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId: verifiedAttribute.id,
          agreementId: agreementEservice.id,
        },
        getMockContext({ authData })
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
