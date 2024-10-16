import { randomUUID } from "crypto";
import {
  decodeProtobufPayload,
  getMockDelegationProducer,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  DelegationStamps,
  delegationState,
  DelegationSubmittedV2,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  delegationNotFound,
  delegationNotRevokable,
  delegatorNotAllowToRevoke,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  delegationProducerService,
  readLastAgreementEvent,
  writeDelegationInEventstore,
} from "./utils.js";

describe("revoke delegation", () => {
  it("should revoke a delegation if it exists", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);
    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);

    const delegationCreationDate = new Date();
    delegationCreationDate.setMonth(currentExecutionTime.getMonth() - 2);

    const delegationApprovalDate = new Date();
    delegationApprovalDate.setMonth(currentExecutionTime.getMonth() - 1);

    const existentDelegation = {
      ...getMockDelegationProducer({
        delegatorId,
        delegateId,
      }),
      approvedAt: delegationApprovalDate,
      submittedAt: delegationCreationDate,
      stamps: {
        submission: {
          who: delegatorId,
          when: delegationCreationDate,
        },
        approval: {
          who: delegateId,
          when: delegationApprovalDate,
        },
      },
    };

    await writeDelegationInEventstore(existentDelegation);
    const lastdelegation = await readLastAgreementEvent(existentDelegation.id);
    const lastdelegationData = decodeProtobufPayload({
      messageType: DelegationSubmittedV2,
      payload: lastdelegation.data,
    });

    expect(lastdelegationData.delegation).toEqual({});

    await addOneDelegation(existentDelegation);

    const actualDelegation = await delegationProducerService.revokeDelegation(
      existentDelegation.id,
      {
        authData,
        logger: genericLogger,
        correlationId: randomUUID(),
        serviceName: "DelegationServiceTest",
      }
    );

    const expectedDelegation: Delegation = {
      ...existentDelegation,
      state: delegationState.revoked,
      revokedAt: currentExecutionTime,
      stamps: {
        ...existentDelegation.stamps,
        revocation: {
          who: delegatorId,
          when: currentExecutionTime,
        },
      },
    };

    expect(actualDelegation).toMatchObject(expectedDelegation);
    const lastDelegationEvent = await readLastAgreementEvent(
      actualDelegation.id
    );

    expect(lastDelegationEvent.version).toBe(2);
    vi.useRealTimers();
  });

  it("should throw an delegationNotFound if Delegation not exists", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();
    await expect(
      delegationProducerService.revokeDelegation(delegationId, {
        authData,
        logger: genericLogger,
        correlationId: randomUUID(),
        serviceName: "DelegationServiceTest",
      })
    ).rejects.toThrow(delegationNotFound(delegationId));
  });

  it("should throw an delegatorNotAllowToRevoke if Requester Id and DelegatorId are differents", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();

    const delegationCreationDate = new Date();
    delegationCreationDate.setMonth(currentExecutionTime.getMonth() - 2);

    const delegationApprovalDate = new Date();
    delegationApprovalDate.setMonth(currentExecutionTime.getMonth() - 1);

    const existentDelegation = {
      ...getMockDelegationProducer({
        delegatorId,
        delegateId,
      }),
      approvedAt: delegationApprovalDate,
      submittedAt: delegationCreationDate,
      stamps: {
        submission: {
          who: delegatorId,
          when: delegationCreationDate,
        },
        approval: {
          who: delegateId,
          when: delegationApprovalDate,
        },
      },
    };

    await addOneDelegation(existentDelegation);

    await expect(
      delegationProducerService.revokeDelegation(delegationId, {
        authData,
        logger: genericLogger,
        correlationId: randomUUID(),
        serviceName: "DelegationServiceTest",
      })
    ).rejects.toThrow(delegatorNotAllowToRevoke(existentDelegation));
    vi.useRealTimers();
  });

  it("should throw an delegatorNotAllowToRevoke if Requester Id and DelegatorId are differents", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();

    const delegationCreationDate = new Date();
    delegationCreationDate.setMonth(currentExecutionTime.getMonth() - 2);

    const delegationApprovalDate = new Date();
    delegationApprovalDate.setMonth(currentExecutionTime.getMonth() - 1);

    const rejectOrRevokeDate = new Date();
    delegationApprovalDate.setMonth(currentExecutionTime.getMonth() - 1);

    const randomInvalidRevocableState = randomArrayItem([
      {
        state: delegationState.rejected,
        rejectedAt: rejectOrRevokeDate,
        rejectionReason: "test rejection",
        stamps: {
          revocation: { who: delegateId, when: rejectOrRevokeDate },
        },
      },
      {
        state: delegationState.revoked,
        revokedAt: rejectOrRevokeDate,
        stamps: {
          rejection: { who: delegateId, when: rejectOrRevokeDate },
        },
      },
    ]);

    const stamps: DelegationStamps = {
      submission: {
        who: delegatorId,
        when: delegationCreationDate,
      },
      activation: {
        who: delegateId,
        when: delegationApprovalDate,
      },
      ...randomInvalidRevocableState.stamps,
    };

    const existentNotRevocableDelegation = {
      ...getMockDelegationProducer({
        delegatorId,
        delegateId,
      }),
      approvedAt: delegationApprovalDate,
      submittedAt: delegationCreationDate,
      ...randomInvalidRevocableState,
      stamps,
    };

    await addOneDelegation(existentNotRevocableDelegation);

    await expect(
      delegationProducerService.revokeDelegation(delegationId, {
        authData,
        logger: genericLogger,
        correlationId: randomUUID(),
        serviceName: "DelegationServiceTest",
      })
    ).rejects.toThrow(delegationNotRevokable(existentNotRevocableDelegation));
    vi.useRealTimers();
  });
});
