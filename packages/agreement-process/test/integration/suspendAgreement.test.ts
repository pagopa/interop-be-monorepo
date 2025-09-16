/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockAgreementAttribute,
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
  randomBoolean,
  sortAgreementV2,
  getMockDescriptorPublished,
  sortAgreement,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  AgreementSuspendedByConsumerV2,
  AgreementSuspendedByProducerV2,
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { match } from "ts-pattern";
import { agreementSuspendableStates } from "../../src/model/domain/agreement-validators.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  eServiceNotFound,
  tenantIsNotTheDelegate,
  tenantNotAllowed,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
  readLastAgreementEvent,
} from "../integrationUtils.js";
import { getRandomPastStamp } from "../mockUtils.js";

describe("suspend agreement", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should succeed when requester is Consumer or Producer and the Agreement is in an suspendable state", async () => {
    const producerId = generateId<TenantId>();
    const tenantOnlyForVerifierAttribute: Tenant = getMockTenant();

    const tenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: tenantOnlyForVerifierAttribute.id,
          verificationDate: new Date(),
        },
      ],
      revokedBy: [],
    };

    // Adding some attributes to consumer, descriptor and eService to verify
    // that the suspension ignores them and does not update them
    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        getMockCertifiedTenantAttribute(),
        getMockDeclaredTenantAttribute(),
        tenantVerifiedAttribute,
      ],
    };

    const descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(consumer.attributes[0].id)]],
        declared: [[getMockEServiceAttribute(consumer.attributes[1].id)]],
        verified: [[getMockEServiceAttribute(consumer.attributes[2].id)]],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: eservice.producerId,
      state: randomArrayItem(agreementSuspendableStates),
      certifiedAttributes: [
        getMockAgreementAttribute(consumer.attributes[0].id),
      ],
      declaredAttributes: [
        getMockAgreementAttribute(consumer.attributes[1].id),
      ],
      verifiedAttributes: [
        getMockAgreementAttribute(consumer.attributes[2].id),
      ],
    };
    await addOneTenant(tenantOnlyForVerifierAttribute);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    const requesterId = randomArrayItem([
      agreement.consumerId,
      agreement.producerId,
    ]);
    const authData = getMockAuthData(requesterId);

    const suspendAgreementResponse = await agreementService.suspendAgreement(
      { agreementId: agreement.id, delegationId: undefined },
      getMockContext({ authData })
    );

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    const isConsumer = requesterId === agreement.consumerId;
    expect(agreementEvent).toMatchObject({
      type: isConsumer
        ? "AgreementSuspendedByConsumer"
        : "AgreementSuspendedByProducer",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementSuspended = decodeProtobufPayload({
      messageType: isConsumer
        ? AgreementSuspendedByConsumerV2
        : AgreementSuspendedByProducerV2,
      payload: agreementEvent.data,
    }).agreement;

    /* The agreement will be suspended with suspendedByConsumer or suspendedByProducer flag set
    to true depending on the requester (consumer or producer) */
    const expectedStamps = {
      suspensionByConsumer: isConsumer
        ? {
            who: authData.userId,
            when: new Date(),
          }
        : agreement.stamps.suspensionByConsumer,
      suspensionByProducer: !isConsumer
        ? {
            who: authData.userId,
            when: new Date(),
          }
        : agreement.stamps.suspensionByProducer,
    };
    const expectedSuspensionFlags = {
      ...(isConsumer ? { suspendedByConsumer: true } : {}),
      ...(!isConsumer ? { suspendedByProducer: true } : {}),
    };

    const expectedAgreementSuspended: Agreement = {
      ...agreement,
      ...expectedSuspensionFlags,
      state: agreementState.suspended,
      suspendedAt: agreement.suspendedAt ?? new Date(),
      stamps: {
        ...agreement.stamps,
        ...expectedStamps,
      },
    };
    expect(actualAgreementSuspended).toEqual(
      toAgreementV2(expectedAgreementSuspended)
    );
    expect(sortAgreement(suspendAgreementResponse)).toEqual({
      data: sortAgreement(expectedAgreementSuspended),
      metadata: {
        version: 1,
      },
    });
  });

  it("should succeed when requester is Consumer or Producer, Agreement producer and consumer are the same, and the Agreement is in an suspendable state", async () => {
    const producerAndConsumerId = generateId<TenantId>();

    const tenantOnlyForVerifierAttribute: Tenant = getMockTenant();

    const tenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: tenantOnlyForVerifierAttribute.id,
          verificationDate: new Date(),
        },
      ],
      revokedBy: [],
    };

    // Adding some attributes to consumer, descriptor and eService to verify
    // that the suspension ignores them and does not update them
    const consumer: Tenant = {
      ...getMockTenant(producerAndConsumerId),
      attributes: [
        getMockCertifiedTenantAttribute(),
        getMockDeclaredTenantAttribute(),
        tenantVerifiedAttribute,
      ],
    };
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(consumer.attributes[0].id)]],
        declared: [[getMockEServiceAttribute(consumer.attributes[1].id)]],
        verified: [[getMockEServiceAttribute(consumer.attributes[2].id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producerAndConsumerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: eservice.producerId,
      state: randomArrayItem(agreementSuspendableStates),
      certifiedAttributes: [
        getMockAgreementAttribute(consumer.attributes[0].id),
      ],
      declaredAttributes: [
        getMockAgreementAttribute(consumer.attributes[1].id),
      ],
      verifiedAttributes: [
        getMockAgreementAttribute(consumer.attributes[2].id),
      ],
    };

    await addOneTenant(tenantOnlyForVerifierAttribute);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(producerAndConsumerId);

    const suspendAgreementResponse = await agreementService.suspendAgreement(
      { agreementId: agreement.id, delegationId: undefined },

      getMockContext({ authData })
    );

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "AgreementSuspendedByProducer",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementSuspended = decodeProtobufPayload({
      messageType: AgreementSuspendedByProducerV2,
      payload: agreementEvent.data,
    }).agreement;

    /* If the consumer and producer of the agreement are the same the agreement will be
    suspended with suspendedByConsumer and suspendedByProducer flags both set to true */
    const expectedAgreementSuspended: Agreement = {
      ...agreement,
      suspendedByConsumer: true,
      suspendedByProducer: true,
      state: agreementState.suspended,
      suspendedAt: agreement.suspendedAt ?? new Date(),
      stamps: {
        ...agreement.stamps,
        suspensionByConsumer: {
          who: authData.userId,
          when: new Date(),
        },
        suspensionByProducer: {
          who: authData.userId,
          when: new Date(),
        },
      },
    };
    expect(actualAgreementSuspended).toEqual(
      toAgreementV2(expectedAgreementSuspended)
    );
    expect(sortAgreement(suspendAgreementResponse)).toEqual({
      data: sortAgreement(expectedAgreementSuspended),
      metadata: {
        version: 1,
      },
    });
  });

  it("should preserve the suspension flags and the stamps that it does not update", async () => {
    const producerId = generateId<TenantId>();

    const consumer = getMockTenant();
    const descriptor: Descriptor = getMockDescriptorPublished();
    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const requesterId = randomArrayItem([consumer.id, producerId]);

    const authData = getMockAuthData(requesterId);
    const agreement: Agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: eservice.producerId,
      state: agreementState.suspended,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      suspendedByPlatform: randomBoolean(),
      stamps: {
        activation: getRandomPastStamp(authData.userId),
        archiving: getRandomPastStamp(authData.userId),
        rejection: getRandomPastStamp(authData.userId),
        submission: getRandomPastStamp(authData.userId),
        upgrade: getRandomPastStamp(authData.userId),
        suspensionByConsumer: getRandomPastStamp(authData.userId),
        suspensionByProducer: getRandomPastStamp(authData.userId),
      },
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    const suspendAgreementResponse = await agreementService.suspendAgreement(
      { agreementId: agreement.id, delegationId: undefined },

      getMockContext({ authData })
    );

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    const isConsumer = requesterId === agreement.consumerId;
    expect(agreementEvent).toMatchObject({
      type: isConsumer
        ? "AgreementSuspendedByConsumer"
        : "AgreementSuspendedByProducer",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementSuspended = decodeProtobufPayload({
      messageType: isConsumer
        ? AgreementSuspendedByConsumerV2
        : AgreementSuspendedByProducerV2,
      payload: agreementEvent.data,
    }).agreement;

    const expectedStamps = {
      suspensionByConsumer: isConsumer
        ? {
            who: authData.userId,
            when: new Date(),
          }
        : agreement.stamps.suspensionByConsumer,
      suspensionByProducer: !isConsumer
        ? {
            who: authData.userId,
            when: new Date(),
          }
        : agreement.stamps.suspensionByProducer,
    };
    const expectedSuspensionFlags = {
      suspendedByConsumer: isConsumer
        ? true
        : agreement.suspendedByConsumer ?? false,
      suspendedByProducer: !isConsumer
        ? true
        : agreement.suspendedByProducer ?? false,
    };
    const expectedAgreementSuspended: Agreement = {
      ...agreement,
      ...expectedSuspensionFlags,
      state: agreementState.suspended,
      suspendedAt: agreement.suspendedAt ?? new Date(),
      stamps: {
        ...agreement.stamps,
        ...expectedStamps,
      },
    };
    expect(sortAgreementV2(actualAgreementSuspended)).toEqual(
      sortAgreementV2(toAgreementV2(expectedAgreementSuspended))
    );
    expect(sortAgreement(suspendAgreementResponse)).toEqual({
      data: sortAgreement(expectedAgreementSuspended),
      metadata: {
        version: 1,
      },
    });
  });

  describe.each(agreementSuspendableStates)(
    "should succeed if the agreement is in %s state",
    async (state) => {
      it.each([
        delegationKind.delegatedConsumer,
        delegationKind.delegatedProducer,
      ])("and the requester is the %s", async (kind) => {
        const tenantOnlyForVerifierAttribute: Tenant = getMockTenant();
        const tenantVerifiedAttribute: VerifiedTenantAttribute = {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: tenantOnlyForVerifierAttribute.id,
              verificationDate: new Date(),
            },
          ],
          revokedBy: [],
        };
        const date = new Date();
        const consumer: Tenant = {
          ...getMockTenant(),
          attributes: [
            getMockCertifiedTenantAttribute(),
            getMockDeclaredTenantAttribute(),
            tenantVerifiedAttribute,
          ],
        };

        const descriptor = {
          ...getMockDescriptorPublished(),
          attributes: {
            certified: [[getMockEServiceAttribute(consumer.attributes[0].id)]],
            declared: [[getMockEServiceAttribute(consumer.attributes[1].id)]],
            verified: [[getMockEServiceAttribute(consumer.attributes[2].id)]],
          },
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [descriptor],
        };
        const agreement = {
          ...getMockAgreement(),
          state,
          eserviceId: eservice.id,
          producerId: eservice.producerId,
          consumerId: consumer.id,
          descriptorId: descriptor.id,
          suspendedByConsumer: false,
          suspendedByProducer: false,
          suspendedByPlatform: false,
        };
        const authData = getMockAuthData();
        const delegation = getMockDelegation({
          kind,
          delegateId: authData.organizationId,
          eserviceId: eservice.id,
          delegatorId: match(kind)
            .with(delegationKind.delegatedProducer, () => eservice.producerId)
            .with(delegationKind.delegatedConsumer, () => consumer.id)
            .exhaustive(),
          state: delegationState.active,
        });

        await addOneTenant(tenantOnlyForVerifierAttribute);
        await addOneAgreement(agreement);
        await addOneEService(eservice);
        await addOneTenant(consumer);
        await addOneDelegation(delegation);

        const expectedAgreement = {
          ...agreement,
          state: agreementState.suspended,
          suspendedByProducer: match(kind)
            .with(delegationKind.delegatedProducer, () => true)
            .with(delegationKind.delegatedConsumer, () => false)
            .exhaustive(),
          suspendedByConsumer: match(kind)
            .with(delegationKind.delegatedProducer, () => false)
            .with(delegationKind.delegatedConsumer, () => true)
            .exhaustive(),
          stamps: {
            ...agreement.stamps,
            ...match(kind)
              .with(delegationKind.delegatedProducer, () => ({
                suspensionByProducer: {
                  delegationId: delegation.id,
                  who: authData.userId,
                  when: date,
                },
              }))
              .with(delegationKind.delegatedConsumer, () => ({
                suspensionByConsumer: {
                  delegationId: delegation.id,
                  who: authData.userId,
                  when: date,
                },
              }))
              .exhaustive(),
          },
        };

        const suspendAgreementResponse =
          await agreementService.suspendAgreement(
            { agreementId: agreement.id, delegationId: delegation.id },
            getMockContext({ authData })
          );

        expect(sortAgreement(suspendAgreementResponse)).toEqual({
          data: sortAgreement(expectedAgreement),
          metadata: {
            version: 1,
          },
        });
      });
    }
  );

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getMockAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.suspendAgreement(
        { agreementId, delegationId: undefined },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw tenantNotAllowed when the requester is not the Consumer or the Producer", async () => {
    const authData = getMockAuthData();
    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      randomArrayItem(agreementSuspendableStates)
    );
    await addOneAgreement(agreement);
    await expect(
      agreementService.suspendAgreement(
        { agreementId: agreement.id, delegationId: undefined },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantNotAllowed(authData.organizationId));
  });

  it("should throw agreementNotInExpectedState when the agreement is not in a rejectable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementSuspendableStates.includes(s)
        )
      ),
    };
    await addOneAgreement(agreement);
    const authData = getMockAuthData(agreement.producerId);
    await expect(
      agreementService.suspendAgreement(
        { agreementId: agreement.id, delegationId: undefined },
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
      state: randomArrayItem(agreementSuspendableStates),
    };
    await addOneAgreement(agreement);
    await addOneTenant(getMockTenant(agreement.consumerId));
    const authData = getMockAuthData(agreement.producerId);
    await expect(
      agreementService.suspendAgreement(
        { agreementId: agreement.id, delegationId: undefined },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a tenantNotFound error when the consumer does not exist", async () => {
    await addOneTenant(getMockTenant());
    const descriptor = getMockDescriptorPublished();
    const eservice = getMockEService(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      [descriptor]
    );
    const consumer = getMockTenant();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementSuspendableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
      descriptorId: descriptor.id,
    };
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    const authData = getMockAuthData(agreement.producerId);

    await expect(
      agreementService.suspendAgreement(
        { agreementId: agreement.id, delegationId: undefined },
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
      state: randomArrayItem(agreementSuspendableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    const authData = getMockAuthData(agreement.producerId);

    await expect(
      agreementService.suspendAgreement(
        { agreementId: agreement.id, delegationId: undefined },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      descriptorNotFound(eservice.id, agreement.descriptorId)
    );
  });

  it.each([
    { kind: delegationKind.delegatedConsumer, desc: "consumer" },
    { kind: delegationKind.delegatedProducer, desc: "producer" },
  ])(
    "should throw tenantIsNotTheDelegate a error when the requester is the $desc but not the $kind",
    async ({ kind }) => {
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [getMockDescriptorPublished()],
      };
      const consumer = getMockTenant();
      const delegate = getMockTenant();
      const agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementSuspendableStates),
        eserviceId: eservice.id,
        producerId: eservice.producerId,
        consumerId: consumer.id,
        descriptorId: eservice.descriptors[0].id,
      };
      const authData = getMockAuthData(
        match(kind)
          .with(delegationKind.delegatedProducer, () => agreement.producerId)
          .with(delegationKind.delegatedConsumer, () => agreement.consumerId)
          .exhaustive()
      );
      const delegation = getMockDelegation({
        kind,
        delegateId: delegate.id,
        eserviceId: eservice.id,
        delegatorId: match(kind)
          .with(delegationKind.delegatedProducer, () => eservice.producerId)
          .with(delegationKind.delegatedConsumer, () => consumer.id)
          .exhaustive(),
        state: delegationState.active,
      });

      await addOneAgreement(agreement);
      await addOneEService(eservice);
      await addOneTenant(consumer);
      await addOneTenant(delegate);
      await addOneDelegation(delegation);

      await expect(
        agreementService.suspendAgreement(
          { agreementId: agreement.id, delegationId: undefined },
          getMockContext({ authData })
        )
      ).rejects.toThrowError(tenantIsNotTheDelegate(authData.organizationId));
    }
  );

  it.each([delegationKind.delegatedProducer, delegationKind.delegatedConsumer])(
    "should throw a tenantIsNotTheDelegate when the requester is the %s but the delegation in not active",
    async (kind) => {
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [getMockDescriptorPublished()],
      };
      const consumer = getMockTenant();
      const agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementSuspendableStates),
        eserviceId: eservice.id,
        producerId: eservice.producerId,
        consumerId: consumer.id,
        descriptorId: eservice.descriptors[0].id,
      };
      const authData = getMockAuthData();
      const delegation = getMockDelegation({
        kind,
        delegateId: authData.organizationId,
        eserviceId: eservice.id,
        delegatorId: match(kind)
          .with(delegationKind.delegatedProducer, () => eservice.producerId)
          .with(delegationKind.delegatedConsumer, () => consumer.id)
          .exhaustive(),
        state: delegationState.waitingForApproval,
      });

      await addOneAgreement(agreement);
      await addOneEService(eservice);
      await addOneTenant(consumer);
      await addOneDelegation(delegation);

      await expect(
        agreementService.suspendAgreement(
          { agreementId: agreement.id, delegationId: delegation.id },
          getMockContext({ authData })
        )
      ).rejects.toThrowError(tenantIsNotTheDelegate(authData.organizationId));
    }
  );
});
