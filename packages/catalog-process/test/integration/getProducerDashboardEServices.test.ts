import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import {
  AgreementState,
  delegationKind,
  delegationState,
  DescriptorState,
  descriptorState,
  EService,
  generateId,
  PurposeVersionState,
  purposeVersionState,
  TenantId,
  agreementState,
} from "pagopa-interop-models";
import { upsertPurpose } from "pagopa-interop-readmodel/testUtils";
import { describe, expect, it } from "vitest";

import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  catalogService,
  readModelDB,
} from "../integrationUtils.js";

describe("getProducerDashboardEServices", () => {
  const requesterId: TenantId = generateId();
  const context = getMockContext({ authData: getMockAuthData(requesterId) });
  const emptyDashboard = {
    eservices: {
      total: 0,
      published: 0,
      suspended: 0,
      archiving: 0,
      archivingSuspended: 0,
    },
    pendingAgreements: 0,
    waitingForApprovalPurposes: 0,
    activeAgreements: 0,
    alignment: {
      aligned: 0,
      agreementWithoutPurposes: 0,
      purposesWithoutAgreement: 0,
    },
    averageActivePurposesPerEService: 0,
  };

  const addEService = async (
    states: DescriptorState[] = [descriptorState.published],
    producerId = requesterId
  ): Promise<EService> => {
    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: states.map((state, index) => ({
        ...getMockDescriptor(),
        version: String(index + 1),
        state,
      })),
    };
    await addOneEService(eservice);
    return eservice;
  };
  const addAgreement = async (
    eservice: EService,
    state: AgreementState,
    consumerId: TenantId = generateId()
  ): Promise<TenantId> => {
    await addOneAgreement({
      ...getMockAgreement(),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      descriptorId: eservice.descriptors[0].id,
      consumerId,
      state,
    });
    return consumerId;
  };
  const addPurpose = async (
    eservice: EService,
    consumerId: TenantId,
    states: PurposeVersionState[]
  ): Promise<void> => {
    await upsertPurpose(
      readModelDB,
      {
        ...getMockPurpose(states.map((state) => getMockPurposeVersion(state))),
        eserviceId: eservice.id,
        consumerId,
      },
      0
    );
  };

  it("should return zero counters for an empty scope", async () => {
    expect(await catalogService.getProducerDashboardEServices(context)).toEqual(
      emptyDashboard
    );
  });

  it("should classify by the latest numeric non-draft version and exclude archived e-services", async () => {
    await addEService([
      descriptorState.published,
      descriptorState.suspended,
      descriptorState.draft,
      descriptorState.waitingForApproval,
    ]);
    await addEService([descriptorState.published, descriptorState.archiving]);
    await addEService([descriptorState.archivingSuspended]);
    await addEService(
      Array.from({ length: 10 }, (_, i) =>
        i === 9 ? descriptorState.published : descriptorState.suspended
      )
    );
    await addEService([descriptorState.published, descriptorState.archived]);
    await addEService([
      descriptorState.draft,
      descriptorState.waitingForApproval,
    ]);
    await addEService([]);
    const result = await catalogService.getProducerDashboardEServices(context);
    expect(result.eservices).toEqual({
      total: 4,
      published: 1,
      suspended: 1,
      archiving: 1,
      archivingSuspended: 1,
    });
  });

  it("should include only owned and actively producer-delegated e-services without duplicates", async () => {
    const owned = await addEService();
    const delegated = await addEService(undefined, generateId<TenantId>());
    const excluded = await addEService(undefined, generateId<TenantId>());
    const delegations = [
      {
        eservice: owned,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        delegateId: requesterId,
      },
      {
        eservice: delegated,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        delegateId: requesterId,
      },
      {
        eservice: delegated,
        state: delegationState.revoked,
        kind: delegationKind.delegatedProducer,
        delegateId: requesterId,
      },
      {
        eservice: excluded,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        delegateId: requesterId,
      },
      {
        eservice: excluded,
        state: delegationState.active,
        kind: delegationKind.delegatedConsumer,
        delegateId: requesterId,
      },
      {
        eservice: excluded,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        delegateId: generateId<TenantId>(),
      },
    ];
    for (const { eservice, ...delegation } of delegations) {
      await addOneDelegation({
        ...getMockDelegation(delegation),
        eserviceId: eservice.id,
        delegatorId: eservice.producerId,
      });
    }
    for (const eservice of [owned, delegated, excluded]) {
      const consumer = await addAgreement(eservice, agreementState.active);
      await addAgreement(eservice, agreementState.pending);
      await addPurpose(eservice, consumer, [
        purposeVersionState.active,
        purposeVersionState.waitingForApproval,
      ]);
    }
    expect(await catalogService.getProducerDashboardEServices(context)).toEqual(
      {
        ...emptyDashboard,
        eservices: { ...emptyDashboard.eservices, total: 2, published: 2 },
        pendingAgreements: 2,
        activeAgreements: 2,
        waitingForApprovalPurposes: 2,
        alignment: {
          aligned: 2,
          agreementWithoutPurposes: 0,
          purposesWithoutAgreement: 0,
        },
        averageActivePurposesPerEService: 1,
      }
    );
  });

  it("should count purposes once and align fruitions by both consumer and e-service", async () => {
    const first = await addEService();
    const second = await addEService();
    await addEService();
    const aligned = await addAgreement(first, agreementState.active);
    await addPurpose(first, aligned, [
      purposeVersionState.active,
      purposeVersionState.waitingForApproval,
    ]);
    await addPurpose(first, aligned, [purposeVersionState.active]);
    await addPurpose(first, aligned, [purposeVersionState.waitingForApproval]);
    // Same consumer on a different e-service has no active purposes there.
    await addAgreement(second, agreementState.active, aligned);
    const inactivePurposes = await addAgreement(first, agreementState.active);
    await addPurpose(first, inactivePurposes, [
      purposeVersionState.suspended,
      purposeVersionState.waitingForApproval,
    ]);
    await addPurpose(first, inactivePurposes, [purposeVersionState.draft]);
    const suspended = await addAgreement(first, agreementState.suspended);
    await addPurpose(first, suspended, [purposeVersionState.active]);
    await addAgreement(first, agreementState.suspended);
    await addAgreement(first, agreementState.pending);
    await addAgreement(first, agreementState.archived);
    await addAgreement(first, agreementState.draft);
    await addPurpose(first, generateId(), [purposeVersionState.archived]);
    const result = await catalogService.getProducerDashboardEServices(context);
    expect(result).toEqual({
      eservices: {
        total: 3,
        published: 3,
        suspended: 0,
        archiving: 0,
        archivingSuspended: 0,
      },
      pendingAgreements: 1,
      waitingForApprovalPurposes: 3,
      activeAgreements: 3,
      alignment: {
        aligned: 1,
        agreementWithoutPurposes: 2,
        purposesWithoutAgreement: 1,
      },
      averageActivePurposesPerEService: 1,
    });
    expect(
      result.alignment.aligned + result.alignment.agreementWithoutPurposes
    ).toBe(result.activeAgreements);
  });

  it("should round the average to one decimal place and count purposes independently of agreements", async () => {
    const eservice = await addEService();
    await addEService();
    await addEService();
    await addPurpose(eservice, generateId(), [purposeVersionState.active]);
    const result = await catalogService.getProducerDashboardEServices(context);
    expect(result.averageActivePurposesPerEService).toBe(0.3);
    expect(result.activeAgreements).toBe(0);
  });

  it("should return a zero average when there are no countable e-services", async () => {
    const eservice = await addEService([descriptorState.archived]);
    await addPurpose(eservice, generateId(), [purposeVersionState.active]);
    const result = await catalogService.getProducerDashboardEServices(context);
    expect(result.eservices.total).toBe(0);
    expect(result.averageActivePurposesPerEService).toBe(0);
  });

  it("should keep owned e-services delegated to another producer in scope", async () => {
    const owned = await addEService();
    await addOneDelegation({
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        state: delegationState.active,
        delegateId: generateId<TenantId>(),
      }),
      eserviceId: owned.id,
      delegatorId: requesterId,
    });
    const consumer = await addAgreement(owned, agreementState.active);
    await addPurpose(owned, consumer, [purposeVersionState.active]);
    expect(await catalogService.getProducerDashboardEServices(context)).toEqual(
      {
        ...emptyDashboard,
        eservices: { ...emptyDashboard.eservices, total: 1, published: 1 },
        activeAgreements: 1,
        alignment: { ...emptyDashboard.alignment, aligned: 1 },
        averageActivePurposesPerEService: 1,
      }
    );
  });
});
