/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockDelegationProducer,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import { describe, expect, it, vi } from "vitest";
import {
  DelegationId,
  DelegationRejectedV2,
  generateId,
  toDelegationV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { delegationState } from "pagopa-interop-models";
import {
  delegationNotFound,
  operationRestrictedToDelegate,
  incorrectState,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  delegationProducerService,
  readLastDelegationEvent,
} from "./utils.js";

describe("reject delegation", () => {
  it("should reject delegation if all validations succed", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegate = getMockTenant();
    const delegation = getMockDelegationProducer({
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    const rejectionReason = "I don't like computers, please send me a pigeon";

    await delegationProducerService.rejectProducerDelegation(
      delegate.id,
      delegation.id,
      generateId(),
      rejectionReason
    );

    const event = await readLastDelegationEvent(delegation.id);

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: DelegationRejectedV2,
      payload: event.data,
    });
    const expectedDelegation = toDelegationV2({
      ...delegation,
      state: delegationState.rejected,
      rejectedAt: currentExecutionTime,
      rejectionReason,
      stamps: {
        ...delegation.stamps,
        rejection: { who: delegate.id, when: currentExecutionTime },
      },
    });
    expect(actualDelegation).toEqual(expectedDelegation);
  });

  it("should throw delegationNotFound when delegation doesn't exist", async () => {
    const delegateId = getMockTenant().id;
    const nonExistentDelegationId =
      unsafeBrandId<DelegationId>("non-existent-id");

    await expect(
      delegationProducerService.rejectProducerDelegation(
        delegateId,
        nonExistentDelegationId,
        generateId(),
        ""
      )
    ).rejects.toThrow(delegationNotFound(nonExistentDelegationId));
  });

  it("should throw operationRestrictedToDelegate when rejecter is not the delegate", async () => {
    const delegate = getMockTenant();
    const wrongDelegate = getMockTenant();
    const delegation = getMockDelegationProducer({
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.rejectProducerDelegation(
        wrongDelegate.id,
        delegation.id,
        generateId(),
        ""
      )
    ).rejects.toThrow(
      operationRestrictedToDelegate(wrongDelegate.id, delegation.id)
    );
  });

  it("should throw incorrectState when delegation is not in WaitingForApproval state", async () => {
    const delegate = getMockTenant();
    const delegation = getMockDelegationProducer({
      state: "Active",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.rejectProducerDelegation(
        delegate.id,
        delegation.id,
        generateId(),
        ""
      )
    ).rejects.toThrow(
      incorrectState(
        delegation.id,
        delegationState.active,
        delegationState.waitingForApproval
      )
    );
  });
});
