/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockContext,
  getMockDeclaredTenantAttribute,
  getMockDelegation,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getMockAuthData,
  randomArrayItem,
  getMockDescriptorPublished,
  sortAgreement,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  AgreementRejectedV2,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  VerifiedTenantAttribute,
  agreementState,
  delegationKind,
  delegationState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { addDays } from "date-fns";
import { agreementRejectableStates } from "../../src/model/domain/agreement-validators.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  eServiceNotFound,
  tenantIsNotTheDelegateProducer,
  tenantIsNotTheProducer,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
  readLastAgreementEvent,
  sortAgreementAttributes,
} from "../integrationUtils.js";

describe("reject agreement", () => {
  it.each([
    {
      desc: "Producer",
      type: "producer",
    },
    {
      desc: "Delegate of an active delegation",
      type: "delegate",
    },
  ])(
    "should succeed when requester is $desc and the Agreement is in a rejectable state",
    async ({ type }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const producer: Tenant = getMockTenant();
      const producerId = producer.id;
      const tenantOnlyForVerifierAttribute: Tenant = getMockTenant();
      const tenantAnotherOnlyForVerifierAttribute: Tenant = getMockTenant();

      const tenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };
      const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const tenantDeclaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        revocationTimestamp: undefined,
      };
      const revokedTenantDeclaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const tenantVerifiedAttribute: VerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(),
        verifiedBy: [
          {
            id: producerId,
            verificationDate: new Date(),
            extensionDate: addDays(new Date(), 30),
          },
        ],
        revokedBy: [],
      };

      const tenantVerifiedAttributeByAnotherProducer: VerifiedTenantAttribute =
        {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: tenantOnlyForVerifierAttribute.id,
              verificationDate: new Date(),
            },
          ],
          revokedBy: [],
        };

      const tenantVerfiedAttributeWithExpiredExtension: VerifiedTenantAttribute =
        {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: producerId,
              verificationDate: new Date(),
              extensionDate: addDays(new Date(), 300),
            },
          ],
          revokedBy: [],
        };

      const tenantVerfiedAttributeNoMatchDescAttribute: VerifiedTenantAttribute =
        {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: tenantAnotherOnlyForVerifierAttribute.id,
              verificationDate: new Date(),
            },
          ],
          revokedBy: [],
        };

      const consumer: Tenant = {
        ...getMockTenant(),
        attributes: [
          tenantCertifiedAttribute,
          revokedTenantCertifiedAttribute,
          tenantDeclaredAttribute,
          revokedTenantDeclaredAttribute,
          tenantVerifiedAttribute,
          tenantVerifiedAttributeByAnotherProducer,
          tenantVerfiedAttributeWithExpiredExtension,
          // Adding some attributes not matching with descriptor attributes
          // to test that they are not kept in the agreement
          tenantVerfiedAttributeNoMatchDescAttribute,
          getMockCertifiedTenantAttribute(),
          getMockDeclaredTenantAttribute(),
        ],
      };
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        attributes: {
          // I add also some attributes not matching with tenant attributes
          // to test that they are not kept in the agreement
          certified: [
            [
              getMockEServiceAttribute(tenantCertifiedAttribute.id),
              getMockEServiceAttribute(revokedTenantCertifiedAttribute.id),
              getMockEServiceAttribute(),
            ],
          ],
          verified: [
            [
              getMockEServiceAttribute(tenantVerifiedAttribute.id),
              getMockEServiceAttribute(
                tenantVerifiedAttributeByAnotherProducer.id
              ),
              getMockEServiceAttribute(
                tenantVerfiedAttributeWithExpiredExtension.id
              ),
              getMockEServiceAttribute(),
            ],
          ],
          declared: [
            [
              getMockEServiceAttribute(tenantDeclaredAttribute.id),
              getMockEServiceAttribute(revokedTenantDeclaredAttribute.id),
              getMockEServiceAttribute(),
            ],
          ],
        },
      };
      const eservice: EService = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };

      const agreement = {
        ...getMockAgreement(),
        eserviceId: eservice.id,
        producerId: eservice.producerId,
        descriptorId: descriptor.id,
        consumerId: consumer.id,
        state: randomArrayItem(agreementRejectableStates),
      };
      await addOneTenant(tenantOnlyForVerifierAttribute);
      await addOneTenant(tenantAnotherOnlyForVerifierAttribute);
      await addOneTenant(producer);
      await addOneTenant(consumer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);

      const authData =
        type === "producer"
          ? getMockAuthData(agreement.producerId)
          : getMockAuthData();

      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegateId: authData.organizationId,
        eserviceId: eservice.id,
        delegatorId: eservice.producerId,
        state: delegationState.active,
      });
      if (type === "delegate") {
        await addOneDelegation(delegation);
      }

      const rejectAgreementReponse = await agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        getMockContext({ authData })
      );

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      expect(agreementEvent).toMatchObject({
        type: "AgreementRejected",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const actualAgreementRejected = decodeProtobufPayload({
        messageType: AgreementRejectedV2,
        payload: agreementEvent.data,
      }).agreement;

      /* We must delete some properties because the rejection
    sets them to undefined thus and the protobuf
    serialization strips them from the payload */
      delete agreement.suspendedByConsumer;
      delete agreement.suspendedByProducer;
      delete agreement.suspendedByPlatform;
      const expectedAgreementRejected: Agreement = {
        ...agreement,
        state: agreementState.rejected,
        rejectionReason: "Rejected by producer due to test reasons",
        // Keeps only not revoked attributes that are matching in descriptor and tenant
        verifiedAttributes: [
          { id: tenantVerifiedAttribute.id },
          { id: tenantVerfiedAttributeWithExpiredExtension.id },
        ],
        declaredAttributes: [{ id: tenantDeclaredAttribute.id }],
        certifiedAttributes: [{ id: tenantCertifiedAttribute.id }],
        stamps: {
          ...agreement.stamps,
          rejection: {
            who: authData.userId,
            when: new Date(),
            ...(type === "delegate" ? { delegationId: delegation.id } : {}),
          },
        },
      };

      expect(sortAgreementAttributes(actualAgreementRejected)).toMatchObject(
        sortAgreementAttributes(toAgreementV2(expectedAgreementRejected))
      );
      expect(sortAgreement(rejectAgreementReponse)).toEqual({
        data: sortAgreement(expectedAgreementRejected),
        metadata: {
          version: 1,
        },
      });
      vi.useRealTimers();
    }
  );

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getMockAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.rejectAgreement(
        agreementId,
        "Rejected by producer due to test reasons",
        getMockContext({ authData })
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw tenantIsNotTheProducer when the requester is not the Producer", async () => {
    const authData = getMockAuthData();
    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      randomArrayItem(agreementRejectableStates)
    );
    await addOneAgreement(agreement);
    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantIsNotTheProducer(authData.organizationId));
  });

  it("should throw agreementNotInExpectedState when the agreement is not in a rejectable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementRejectableStates.includes(s)
        )
      ),
    };
    await addOneAgreement(agreement);
    const authData = getMockAuthData(agreement.producerId);
    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an eServiceNotFound error when the eService does not exist", async () => {
    await addOneEService(getMockEService());
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementRejectableStates),
    };
    await addOneAgreement(agreement);
    const authData = getMockAuthData(agreement.producerId);
    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        getMockContext({ authData })
      )
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a tenantNotFound error when the consumer does not exist", async () => {
    await addOneTenant(getMockTenant());

    const descriptor = getMockDescriptorPublished();

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    const consumer = getMockTenant();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementRejectableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
      descriptorId: descriptor.id,
    };
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    const authData = getMockAuthData(agreement.producerId);

    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantNotFound(agreement.consumerId));
  });

  it("should throw a descriptorNotFound error when the descriptor does not exist", async () => {
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptorPublished()],
    };
    const consumer = getMockTenant();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementRejectableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    const authData = getMockAuthData(agreement.producerId);

    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      descriptorNotFound(eservice.id, agreement.descriptorId)
    );
  });

  it("should throw tenantIsNotTheDelegateProducer when the requester is the producer and there is an active delegation", async () => {
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptorPublished()],
    };
    const consumer = getMockTenant();
    const delegate = getMockTenant();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementRejectableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
      descriptorId: eservice.descriptors[0].id,
    };
    const authData = getMockAuthData(agreement.producerId);
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      delegateId: delegate.id,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneAgreement(agreement);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(delegate);
    await addOneDelegation(delegation);

    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegateProducer(authData.organizationId, delegation.id)
    );
  });

  it("should throw a tenantIsNotTheProducer error when the requester is the delegate but the delegation in not active", async () => {
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptorPublished()],
    };
    const consumer = getMockTenant();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementRejectableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
      descriptorId: eservice.descriptors[0].id,
    };
    const authData = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      delegateId: authData.organizationId,
      eserviceId: eservice.id,
      state: delegationState.waitingForApproval,
    });

    await addOneAgreement(agreement);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneDelegation(delegation);

    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",

        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantIsNotTheProducer(authData.organizationId));
  });
});
