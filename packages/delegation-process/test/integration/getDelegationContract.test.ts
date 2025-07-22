/* eslint-disable functional/no-let */
import {
  getMockContext,
  getMockDelegation,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  DelegationContractDocument,
  DelegationContractId,
  DelegationId,
  delegationKind,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  delegationContractNotFound,
  delegationNotFound,
} from "../../src/model/domain/errors.js";
import { addOneDelegation, delegationService } from "../integrationUtils.js";

describe("getDelegationContract", () => {
  const mockContract: DelegationContractDocument = {
    id: generateId(),
    contentType: "application/pdf",
    createdAt: new Date(),
    name: "contract",
    path: "path",
    prettyName: "prettyName",
  };

  it("should get the delegation contract if it exists", async () => {
    const delegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
      }),
      activationContract: mockContract,
    };

    await addOneDelegation(delegation);

    const returnedContract = await delegationService.getDelegationContract(
      delegation.id,
      mockContract.id,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    expect(returnedContract).toEqual(mockContract);
  });

  it("should throw delegationNotFound error if delegation does not exist", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
    });

    await addOneDelegation(delegation);

    const notFoundId = generateId<DelegationId>();
    const returnedContract = delegationService.getDelegationContract(
      notFoundId,
      mockContract.id,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    await expect(returnedContract).rejects.toThrow(
      delegationNotFound(notFoundId)
    );
  });

  it("should throw delegationContractNotFound error if the delegation contract does not exist", async () => {
    const delegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
      }),
      activationContract: mockContract,
    };

    await addOneDelegation(delegation);

    const falseContractId = generateId<DelegationContractId>();
    const returnedContract = delegationService.getDelegationContract(
      delegation.id,
      falseContractId,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    await expect(returnedContract).rejects.toThrow(
      delegationContractNotFound(delegation.id, falseContractId)
    );
  });

  it("should throw operationNotAllowed error if requester is not the delegate nor the delegator", async () => {
    const delegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
      }),
      activationContract: mockContract,
    };

    await addOneDelegation(delegation);

    const returnedContract = delegationService.getDelegationContract(
      delegation.id,
      mockContract.id,
      getMockContext({})
    );

    await expect(returnedContract).rejects.toThrow(operationForbidden);
  });
});
