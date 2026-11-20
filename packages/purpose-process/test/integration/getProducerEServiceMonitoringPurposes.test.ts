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
  Agreement,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Purpose,
  PurposeVersionState,
  TenantId,
  agreementState,
  delegationKind,
  delegationState,
  descriptorState,
  featureFlagNotEnabled,
  generateId,
  purposeVersionState,
} from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { config } from "../../src/config/config.js";
import {
  descriptorNotFound,
  eserviceNotFound,
  tenantIsNotTheDelegatedProducer,
  tenantIsNotTheProducer,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  purposeService,
} from "../integrationUtils.js";

describe("getProducerEServiceMonitoringPurposes", () => {
  const producerId: TenantId = generateId();
  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    dailyCallsPerConsumer: 100,
    dailyCallsTotal: 1000,
  };
  const eservice: EService = getMockEService(
    generateId<EServiceId>(),
    producerId,
    [descriptor]
  );
  const ctx = getMockContext({ authData: getMockAuthData(producerId) });

  const addConsumerWithPurpose = async (
    states: Array<[PurposeVersionState, number]>,
    options: {
      descriptorId?: DescriptorId;
      agreementState?: Agreement["state"];
      eservice?: EService;
    } = {}
  ): Promise<Purpose> => {
    const purposeEService = options.eservice ?? eservice;
    const consumerId: TenantId = generateId();
    await addOneAgreement({
      ...getMockAgreement(
        purposeEService.id,
        consumerId,
        options.agreementState ?? agreementState.active
      ),
      descriptorId:
        options.descriptorId ??
        options.eservice?.descriptors[0]?.id ??
        descriptor.id,
      producerId,
    });
    const purpose: Purpose = {
      ...getMockPurpose(
        states.map(([state, dailyCalls]) => ({
          ...getMockPurposeVersion(state),
          dailyCalls,
        }))
      ),
      eserviceId: purposeEService.id,
      consumerId,
    };
    await addOnePurpose(purpose);
    return purpose;
  };

  beforeEach(async () => {
    config.featureFlagProducerDashboard = true;
    await addOneEService(eservice);
  });

  afterEach(() => {
    config.featureFlagProducerDashboard = false;
  });

  it("should compute the load, the percentage and the waiting purposes of the descriptor", async () => {
    await addConsumerWithPurpose([[purposeVersionState.active, 100]]);
    // Suspended versions do not contribute to the load
    await addConsumerWithPurpose([[purposeVersionState.suspended, 500]]);
    await addConsumerWithPurpose([
      [purposeVersionState.active, 50],
      [purposeVersionState.waitingForApproval, 80],
    ]);
    await addConsumerWithPurpose([
      [purposeVersionState.waitingForApproval, 30],
    ]);
    await addConsumerWithPurpose([
      [purposeVersionState.suspended, 10],
      [purposeVersionState.waitingForApproval, 20],
    ]);
    await addConsumerWithPurpose([
      [purposeVersionState.waitingForApproval, 30],
    ]);

    const result = await purposeService.getProducerEServiceMonitoringPurposes(
      eservice.id,
      descriptor.id,
      ctx
    );

    expect(result).toEqual({
      approvedDailyCalls: 150,
      dailyCallsTotal: 1000,
      percentage: 15,
      waitingForApprovalNewPurposes: 2,
      waitingForApprovalQuotaChanges: 2,
    });
  });

  it("should count a purpose once even with multiple versions waiting for approval", async () => {
    await addConsumerWithPurpose([
      [purposeVersionState.active, 10],
      [purposeVersionState.archived, 10],
      [purposeVersionState.waitingForApproval, 20],
      [purposeVersionState.waitingForApproval, 30],
    ]);

    const result = await purposeService.getProducerEServiceMonitoringPurposes(
      eservice.id,
      descriptor.id,
      ctx
    );

    expect(result.waitingForApprovalNewPurposes).toBe(0);
    expect(result.waitingForApprovalQuotaChanges).toBe(1);
  });

  it("should ignore consumers with an agreement on another descriptor or with a non Active/Suspended agreement", async () => {
    await addConsumerWithPurpose([[purposeVersionState.active, 100]]);
    await addConsumerWithPurpose([[purposeVersionState.active, 200]], {
      descriptorId: generateId<DescriptorId>(),
    });
    await addConsumerWithPurpose([[purposeVersionState.active, 300]], {
      agreementState: agreementState.archived,
    });
    await addConsumerWithPurpose(
      [[purposeVersionState.waitingForApproval, 300]],
      { agreementState: agreementState.pending }
    );

    const result = await purposeService.getProducerEServiceMonitoringPurposes(
      eservice.id,
      descriptor.id,
      ctx
    );

    expect(result.approvedDailyCalls).toBe(100);
    expect(result.percentage).toBe(10);
    expect(result.waitingForApprovalNewPurposes).toBe(0);
    expect(result.waitingForApprovalQuotaChanges).toBe(0);
  });

  it("should not limit the percentage to 100", async () => {
    await addConsumerWithPurpose([[purposeVersionState.active, 1500]]);

    const result = await purposeService.getProducerEServiceMonitoringPurposes(
      eservice.id,
      descriptor.id,
      ctx
    );

    expect(result.percentage).toBe(150);
  });

  it("should round the percentage to the nearest integer", async () => {
    await addConsumerWithPurpose([[purposeVersionState.active, 5]]);

    const result = await purposeService.getProducerEServiceMonitoringPurposes(
      eservice.id,
      descriptor.id,
      ctx
    );

    expect(result.percentage).toBe(1);
  });

  it("should return a zero percentage when the descriptor total is zero", async () => {
    const zeroTotalDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 0,
    };
    const zeroTotalEService = getMockEService(
      generateId<EServiceId>(),
      producerId,
      [zeroTotalDescriptor]
    );
    await addOneEService(zeroTotalEService);
    await addConsumerWithPurpose([[purposeVersionState.active, 20]], {
      eservice: zeroTotalEService,
    });

    const result = await purposeService.getProducerEServiceMonitoringPurposes(
      zeroTotalEService.id,
      zeroTotalDescriptor.id,
      ctx
    );

    expect(result).toEqual({
      approvedDailyCalls: 20,
      dailyCallsTotal: 0,
      percentage: 0,
      waitingForApprovalNewPurposes: 0,
      waitingForApprovalQuotaChanges: 0,
    });
  });

  it("should include active versions and waiting purposes for suspended agreements", async () => {
    await addConsumerWithPurpose(
      [
        [purposeVersionState.active, 35],
        [purposeVersionState.waitingForApproval, 10],
      ],
      { agreementState: agreementState.suspended }
    );

    const result = await purposeService.getProducerEServiceMonitoringPurposes(
      eservice.id,
      descriptor.id,
      ctx
    );

    expect(result.approvedDailyCalls).toBe(35);
    expect(result.waitingForApprovalNewPurposes).toBe(0);
    expect(result.waitingForApprovalQuotaChanges).toBe(1);
  });

  it("should count a waiting purpose with only archived versions as new", async () => {
    await addConsumerWithPurpose([
      [purposeVersionState.archived, 10],
      [purposeVersionState.waitingForApproval, 20],
    ]);

    const result = await purposeService.getProducerEServiceMonitoringPurposes(
      eservice.id,
      descriptor.id,
      ctx
    );

    expect(result.waitingForApprovalNewPurposes).toBe(1);
    expect(result.waitingForApprovalQuotaChanges).toBe(0);
  });

  it("should return zeros when there are no purposes", async () => {
    const result = await purposeService.getProducerEServiceMonitoringPurposes(
      eservice.id,
      descriptor.id,
      ctx
    );

    expect(result).toEqual({
      approvedDailyCalls: 0,
      dailyCallsTotal: 1000,
      percentage: 0,
      waitingForApprovalNewPurposes: 0,
      waitingForApprovalQuotaChanges: 0,
    });
  });

  it("should allow the active producer delegate and reject the producer", async () => {
    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegateId: delegate.organizationId,
      delegatorId: producerId,
      state: delegationState.active,
    });
    await addOneDelegation(delegation);

    await expect(
      purposeService.getProducerEServiceMonitoringPurposes(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: delegate })
      )
    ).resolves.toBeDefined();

    await expect(
      purposeService.getProducerEServiceMonitoringPurposes(
        eservice.id,
        descriptor.id,
        ctx
      )
    ).rejects.toThrow(
      tenantIsNotTheDelegatedProducer(producerId, delegation.id)
    );
  });

  it("should throw tenantIsNotTheProducer if the requester is not the producer", async () => {
    const requester = getMockAuthData();
    await expect(
      purposeService.getProducerEServiceMonitoringPurposes(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: requester })
      )
    ).rejects.toThrow(tenantIsNotTheProducer(requester.organizationId));
  });

  it("should throw eserviceNotFound if the e-service does not exist", async () => {
    const unknownId = generateId<EService["id"]>();
    await expect(
      purposeService.getProducerEServiceMonitoringPurposes(
        unknownId,
        descriptor.id,
        ctx
      )
    ).rejects.toThrow(eserviceNotFound(unknownId));
  });

  it("should throw descriptorNotFound if the descriptor does not exist", async () => {
    const unknownId = generateId<DescriptorId>();
    await expect(
      purposeService.getProducerEServiceMonitoringPurposes(
        eservice.id,
        unknownId,
        ctx
      )
    ).rejects.toThrow(descriptorNotFound(eservice.id, unknownId));
  });

  it("should throw featureFlagNotEnabled if the feature flag is disabled", async () => {
    config.featureFlagProducerDashboard = false;
    await expect(
      purposeService.getProducerEServiceMonitoringPurposes(
        eservice.id,
        descriptor.id,
        ctx
      )
    ).rejects.toThrow(featureFlagNotEnabled("featureFlagProducerDashboard"));
  });
});
