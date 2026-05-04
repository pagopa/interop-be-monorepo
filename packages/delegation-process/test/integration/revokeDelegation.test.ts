import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockEService,
  getMockTenant,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  ConsumerDelegationRevokedV2,
  delegationState,
  generateId,
  TenantId,
  EServiceId,
  delegationKind,
  UserId,
  toDelegationV2,
  ProducerDelegationRevokedV2,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  delegationNotFound,
  incorrectState,
  operationRestrictedToDelegator,
} from "../../src/model/domain/errors.js";
import {
  activeDelegationStates,
  inactiveDelegationStates,
} from "../../src/services/validators.js";
import {
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationService,
  readLastDelegationEvent,
} from "../integrationUtils.js";

const TEST_EXECUTION_DATE = new Date();

describe.each([
  delegationKind.delegatedConsumer,
  delegationKind.delegatedProducer,
])("revoke %s delegation", (kind) => {
  const revokeFn =
    kind === delegationKind.delegatedConsumer
      ? delegationService.revokeConsumerDelegation
      : delegationService.revokeProducerDelegation;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_EXECUTION_DATE);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should revoke a delegation if it exists", async () => {
    const currentExecutionTime = new Date();
    const eserviceId = generateId<EServiceId>();
    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getMockAuthData(delegatorId);

    const delegationCreationDate = new Date();
    delegationCreationDate.setMonth(currentExecutionTime.getMonth() - 2);

    const delegationActivationDate = new Date();
    delegationActivationDate.setMonth(currentExecutionTime.getMonth() - 1);

    const delegate = getMockTenant(delegateId);
    const delegator = getMockTenant(delegatorId);
    const eservice = getMockEService(eserviceId);

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);

    const existentDelegation: Delegation = {
      ...getMockDelegation({
        kind,
        delegatorId,
        delegateId,
      }),
      eserviceId,
      stamps: {
        submission: {
          who: generateId<UserId>(),
          when: delegationCreationDate,
        },
        activation: {
          who: generateId<UserId>(),
          when: delegationActivationDate,
        },
      },
    };

    await addOneDelegation(existentDelegation);

    await revokeFn(existentDelegation.id, getMockContext({ authData }));

    const event = await readLastDelegationEvent(existentDelegation.id);
    expect(event.version).toBe("1");

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType:
        kind === delegationKind.delegatedConsumer
          ? ConsumerDelegationRevokedV2
          : ProducerDelegationRevokedV2,
      payload: event.data,
    });

    const revokedDelegationWithoutContract: Delegation = {
      ...existentDelegation,
      state: delegationState.revoked,
      updatedAt: currentExecutionTime,
      stamps: {
        ...existentDelegation.stamps,
        revocation: {
          who: authData.userId,
          when: currentExecutionTime,
        },
      },
    };

    const expectedDelegation = toDelegationV2(revokedDelegationWithoutContract);
    expect(actualDelegation).toEqual(expectedDelegation);
    expect(actualDelegation!.revocationContract).toBeUndefined();
  });

  it("should throw a delegationNotFound if Delegation does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getMockAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();
    await expect(
      revokeFn(delegationId, getMockContext({ authData }))
    ).rejects.toThrow(delegationNotFound(delegationId, kind));
  });

  it(`should throw delegationNotFound when delegation kind is not ${kind}`, async () => {
    const delegate = getMockTenant();
    const delegation = getMockDelegation({
      kind:
        kind === delegationKind.delegatedConsumer
          ? delegationKind.delegatedProducer
          : delegationKind.delegatedConsumer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      revokeFn(
        delegation.id,
        getMockContext({ authData: getMockAuthData(delegate.id) })
      )
    ).rejects.toThrow(delegationNotFound(delegation.id, kind));
  });

  it("should throw a delegatorNotAllowToRevoke if Requester is not Delegator", async () => {
    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getMockAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();

    const existentDelegation = getMockDelegation({
      kind,
      id: delegationId,
      delegateId,
    });

    await addOneDelegation(existentDelegation);

    await expect(
      revokeFn(delegationId, getMockContext({ authData }))
    ).rejects.toThrow(
      operationRestrictedToDelegator(delegatorId, delegationId)
    );
    vi.useRealTimers();
  });

  it.each(inactiveDelegationStates)(
    "should throw incorrectState when delegation is in %s state",
    async (state) => {
      const delegatorId = generateId<TenantId>();
      const delegateId = generateId<TenantId>();
      const authData = getMockAuthData(delegatorId);

      const existentDelegation: Delegation = getMockDelegation({
        kind,
        delegatorId,
        delegateId,
        state,
      });

      await addOneDelegation(existentDelegation);

      await expect(
        revokeFn(existentDelegation.id, getMockContext({ authData }))
      ).rejects.toThrow(
        incorrectState(
          existentDelegation.id,
          existentDelegation.state,
          activeDelegationStates
        )
      );
    }
  );
});
