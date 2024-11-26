/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockDelegation,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import { describe, expect, it, vi } from "vitest";
import {
  ConsumerDelegationRejectedV2,
  DelegationId,
  delegationKind,
  generateId,
  toDelegationV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { delegationState } from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  delegationNotFound,
  operationRestrictedToDelegate,
  incorrectState,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  delegationConsumerService,
  readLastDelegationEvent,
} from "./utils.js";

describe("reject consumer delegation", () => {
  it("should reject delegation if all validations succed", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegate = getMockTenant();
    const authData = getRandomAuthData(delegate.id);
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    const rejectionReason = "I don't like computers, please send me a pigeon";

    await delegationConsumerService.rejectConsumerDelegation(
      delegation.id,
      rejectionReason,
      {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    const event = await readLastDelegationEvent(delegation.id);

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: ConsumerDelegationRejectedV2,
      payload: event.data,
    });
    const expectedDelegation = toDelegationV2({
      ...delegation,
      state: delegationState.rejected,
      rejectedAt: currentExecutionTime,
      rejectionReason,
      stamps: {
        ...delegation.stamps,
        rejection: { who: authData.userId, when: currentExecutionTime },
      },
    });
    expect(actualDelegation).toEqual(expectedDelegation);
  });

  it("should throw delegationNotFound when delegation doesn't exist", async () => {
    const delegateId = getMockTenant().id;
    const nonExistentDelegationId =
      unsafeBrandId<DelegationId>("non-existent-id");

    await expect(
      delegationConsumerService.rejectConsumerDelegation(
        nonExistentDelegationId,
        "",
        {
          authData: getMockAuthData(delegateId),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrow(delegationNotFound(nonExistentDelegationId));
  });

  it("should throw operationRestrictedToDelegate when rejecter is not the delegate", async () => {
    const delegate = getMockTenant();
    const wrongDelegate = getMockTenant();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationConsumerService.rejectConsumerDelegation(delegation.id, "", {
        authData: getMockAuthData(wrongDelegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(
      operationRestrictedToDelegate(wrongDelegate.id, delegation.id)
    );
  });

  it("should throw incorrectState when delegation is not in WaitingForApproval state", async () => {
    const delegate = getMockTenant();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      state: "Active",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationConsumerService.rejectConsumerDelegation(delegation.id, "", {
        authData: getMockAuthData(delegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(
      incorrectState(
        delegation.id,
        delegationState.active,
        delegationState.waitingForApproval
      )
    );
  });
});
