/* eslint-disable functional/no-let */
import {
  getMockAuthData,
  getMockDelegation,
} from "pagopa-interop-commons-test/index.js";
import {
  DelegationContractDocument,
  DelegationContractId,
  DelegationId,
  delegationKind,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  delegationContractNotFound,
  delegationNotFound,
} from "../src/model/domain/errors.js";
import { addOneDelegation, delegationService } from "./utils.js";

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
      {
        authData: getMockAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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
      {
        authData: getMockAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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
      {
        authData: getMockAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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
      {
        authData: getMockAuthData(),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    await expect(returnedContract).rejects.toThrow(operationForbidden);
  });
});
