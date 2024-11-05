/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockDelegationProducer,
  getMockTenant,
  getMockEService,
} from "pagopa-interop-commons-test/index.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DelegationApprovedV2,
  DelegationContractId,
  DelegationId,
  EService,
  generateId,
  Tenant,
  toDelegationV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { delegationState } from "pagopa-interop-models";
import {
  formatDateyyyyMMddHHmmss,
  genericLogger,
} from "pagopa-interop-commons";
import {
  delegationNotFound,
  operationRestrictedToDelegate,
  incorrectState,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  addOneDelegation,
  addOneTenant,
  addOneEservice,
  delegationProducerService,
  fileManager,
  readLastDelegationEvent,
} from "./utils.js";

describe("approve delegation", () => {
  const currentExecutionTime = new Date();
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

    const delegation = getMockDelegationProducer({
      id: delegationId,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);
    const { version } = await readLastDelegationEvent(delegation.id);
    expect(version).toBe("0");

    await delegationProducerService.approveProducerDelegation(
      delegate.id,
      delegation.id,
      generateId(),
      genericLogger
    );

    const event = await readLastDelegationEvent(delegation.id);
    expect(event.version).toBe("1");

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: DelegationApprovedV2,
      payload: event.data,
    });

    const expectedContractFilePath = (
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    )[0];

    const documentId = unsafeBrandId<DelegationContractId>(
      expectedContractFilePath.split("/")[2]
    );

    const expectedDelegation = {
      ...toDelegationV2({
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
        activationContract: {
          id: documentId,
          contentType: "application/pdf",
          createdAt: currentExecutionTime,
          name: `${formatDateyyyyMMddHHmmss(
            currentExecutionTime
          )}_delegation_activation_contract.pdf`,
          path: expectedContractFilePath,
          prettyName: "Delega",
        },
      }),
    };
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
        generateId(),
        genericLogger
      )
    ).rejects.toThrow(delegationNotFound(nonExistentDelegationId));
  });

  it("should throw operationRestrictedToDelegate when approver is not the delegate", async () => {
    const wrongDelegate = getMockTenant();
    await addOneTenant(wrongDelegate);
    const delegation = getMockDelegationProducer({
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.approveProducerDelegation(
        wrongDelegate.id,
        delegation.id,
        generateId(),
        genericLogger
      )
    ).rejects.toThrow(
      operationRestrictedToDelegate(wrongDelegate.id, delegation.id)
    );
  });

  it("should throw incorrectState when delegation is not in WaitingForApproval state", async () => {
    const delegation = getMockDelegationProducer({
      state: "Active",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.approveProducerDelegation(
        delegate.id,
        delegation.id,
        generateId(),
        genericLogger
      )
    ).rejects.toThrow(
      incorrectState(
        delegation.id,
        delegationState.active,
        delegationState.waitingForApproval
      )
    );
  });

  it("should generete a pdf document for a delegation", async () => {
    const delegation = getMockDelegationProducer({
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);
    const { version } = await readLastDelegationEvent(delegation.id);
    expect(version).toBe("0");

    await delegationProducerService.approveProducerDelegation(
      delegate.id,
      delegation.id,
      unsafeBrandId("9999"),
      genericLogger
    );

    const contracts = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    const hasActivationContract = contracts.find(
      (contract) =>
        contract.includes("activation") && contract.includes(delegation.id)
    );

    expect(hasActivationContract).toBeTruthy();
  });
});
