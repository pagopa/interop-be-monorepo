/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockTenant,
  getMockEService,
  getMockAuthData,
  getMockContext,
} from "pagopa-interop-commons-test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConsumerDelegationApprovedV2,
  DelegationId,
  EService,
  generateId,
  Tenant,
  toDelegationV2,
  delegationKind,
  Delegation,
} from "pagopa-interop-models";
import { delegationState } from "pagopa-interop-models";
import {
  delegationNotFound,
  operationRestrictedToDelegate,
  incorrectState,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneTenant,
  addOneEservice,
  readLastDelegationEvent,
  delegationService,
} from "../integrationUtils.js";

const currentExecutionTime = new Date();

describe.each([
  delegationKind.delegatedConsumer,
  delegationKind.delegatedProducer,
])("approve %s delegation", (kind) => {
  const approveFn =
    kind === delegationKind.delegatedConsumer
      ? delegationService.approveConsumerDelegation
      : delegationService.approveProducerDelegation;

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);
  });

  let delegate: Tenant;
  let delegator: Tenant;
  let eservice: EService;

  beforeEach(async () => {
    delegate = getMockTenant();
    delegator = getMockTenant();
    eservice = getMockEService();
    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);
  });

  it("should approve delegation if validations succeed", async () => {
    const delegationId = generateId<DelegationId>();
    const authData = getMockAuthData(delegate.id);

    const delegation = getMockDelegation({
      kind,
      id: delegationId,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);
    const { version } = await readLastDelegationEvent(delegation.id);
    expect(version).toBe("0");

    const approveDelegationResponse = await approveFn(
      delegation.id,
      getMockContext({ authData })
    );

    const event = await readLastDelegationEvent(delegation.id);
    expect(event.version).toBe("1");

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: ConsumerDelegationApprovedV2,
      payload: event.data,
    });

    const expectedDelegation: Delegation = {
      ...delegation,
      state: delegationState.active,
      createdAt: currentExecutionTime,
      updatedAt: currentExecutionTime,
      stamps: {
        ...delegation.stamps,
        activation: {
          who: authData.userId,
          when: currentExecutionTime,
        },
      },
    };

    expect(actualDelegation).toEqual(toDelegationV2(expectedDelegation));
    expect(approveDelegationResponse).toEqual({
      data: expectedDelegation,
      metadata: {
        version: 1,
      },
    });
    expect(actualDelegation!.activationContract).toBeUndefined();
  });

  it("should throw delegationNotFound when delegation doesn't exist", async () => {
    const delegateId = getMockTenant().id;
    const nonExistentDelegationId = generateId<DelegationId>();

    await expect(
      approveFn(
        nonExistentDelegationId,
        getMockContext({ authData: getMockAuthData(delegateId) })
      )
    ).rejects.toThrow(delegationNotFound(nonExistentDelegationId, kind));
  });

  it(`should throw delegationNotFound when delegation kind is not ${kind}`, async () => {
    const delegation = getMockDelegation({
      kind:
        kind === delegationKind.delegatedConsumer
          ? delegationKind.delegatedProducer
          : delegationKind.delegatedConsumer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(
      approveFn(
        delegation.id,
        getMockContext({ authData: getMockAuthData(delegate.id) })
      )
    ).rejects.toThrow(delegationNotFound(delegation.id, kind));
  });

  it("should throw operationRestrictedToDelegate when approver is not the delegate", async () => {
    const wrongDelegate = getMockTenant();
    await addOneTenant(wrongDelegate);
    const delegation = getMockDelegation({
      kind,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(
      approveFn(
        delegation.id,
        getMockContext({ authData: getMockAuthData(wrongDelegate.id) })
      )
    ).rejects.toThrow(
      operationRestrictedToDelegate(wrongDelegate.id, delegation.id)
    );
  });

  it.each(
    Object.values(delegationState).filter(
      (state) => state !== delegationState.waitingForApproval
    )
  )(
    "should throw incorrectState when delegation is in %s state",
    async (state) => {
      const delegation = getMockDelegation({
        kind,
        state,
        delegateId: delegate.id,
        delegatorId: delegator.id,
        eserviceId: eservice.id,
      });
      await addOneDelegation(delegation);

      await expect(
        approveFn(
          delegation.id,
          getMockContext({ authData: getMockAuthData(delegate.id) })
        )
      ).rejects.toThrow(
        incorrectState(delegation.id, state, delegationState.waitingForApproval)
      );
    }
  );

  it("should not generate activation contract synchronously", async () => {
    const delegation = getMockDelegation({
      kind,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);
    const { version } = await readLastDelegationEvent(delegation.id);
    expect(version).toBe("0");

    await approveFn(
      delegation.id,
      getMockContext({ authData: getMockAuthData(delegate.id) })
    );

    const event = await readLastDelegationEvent(delegation.id);
    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: ConsumerDelegationApprovedV2,
      payload: event.data,
    });

    expect(actualDelegation!.activationContract).toBeUndefined();
  });
});
