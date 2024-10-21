/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockDelegationProducer,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import { describe, expect, it, vi } from "vitest";
import {
  DelegationApprovedV2,
  DelegationId,
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

describe("approve delegation", () => {
  it("should approve delegation if validations succed", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegate = getMockTenant();
    const delegation = getMockDelegationProducer({
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);
    const { version } = await readLastDelegationEvent(delegation.id);
    expect(version).toBe("0");

    await delegationProducerService.approveProducerDelegation(
      delegate.id,
      delegation.id,
      "9999"
    );

    const event = await readLastDelegationEvent(delegation.id);
    expect(event.version).toBe("1");

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: DelegationApprovedV2,
      payload: event.data,
    });
    const expectedDelegation = toDelegationV2({
      ...delegation,
      state: delegationState.active,
      approvedAt: currentExecutionTime,
      stamps: {
        ...delegation.stamps,
        activation: {
          who: delegate.id,
          when: currentExecutionTime,
        },
      },
    });
    expect(actualDelegation).toEqual(expectedDelegation);
  });

  it("should throw delegationNotFound when delegation doesn't exist", async () => {
    const delegateId = getMockTenant().id;
    const nonExistentDelegationId =
      unsafeBrandId<DelegationId>("non-existent-id");

    await expect(
      delegationProducerService.approveProducerDelegation(
        delegateId,
        nonExistentDelegationId,
        "9999"
      )
    ).rejects.toThrow(delegationNotFound(nonExistentDelegationId));
  });

  it("should throw operationRestrictedToDelegate when approver is not the delegate", async () => {
    const delegate = getMockTenant();
    const wrongDelegate = getMockTenant();
    const delegation = getMockDelegationProducer({
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.approveProducerDelegation(
        wrongDelegate.id,
        delegation.id,
        "9999"
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
      delegationProducerService.approveProducerDelegation(
        delegate.id,
        delegation.id,
        "9999"
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
