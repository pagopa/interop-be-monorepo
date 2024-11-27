/* eslint-disable functional/no-let */
import { getMockDelegation } from "pagopa-interop-commons-test/index.js";
import {
  DelegationId,
  DelegationKind,
  delegationKind,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { delegationNotFound } from "../src/model/domain/errors.js";
import { addOneDelegation, delegationService } from "./utils.js";

describe("get delegation by id", () => {
  it("should get the consumer delegation if it exists", async () => {
    await testDelegationRetrieval(delegationKind.delegatedConsumer);
  });

  it("should get the producer delegation if it exists", async () => {
    await testDelegationRetrieval(delegationKind.delegatedProducer);
  });

  it("should fail with delegationNotFound for consumer delegations", async () => {
    await testDelegationNotFound(delegationKind.delegatedConsumer);
  });

  it("should fail with delegationNotFound for producer delegations", async () => {
    await testDelegationNotFound(delegationKind.delegatedProducer);
  });

  const testDelegationRetrieval = async (
    kind: DelegationKind
  ): Promise<void> => {
    const delegation = getMockDelegation({ kind });
    await addOneDelegation(delegation);

    const expectedDelegation = await delegationService.getDelegationById(
      delegation.id,
      genericLogger
    );

    expect(delegation).toEqual(expectedDelegation);
  };

  const testDelegationNotFound = async (
    kind: DelegationKind
  ): Promise<void> => {
    const delegation = getMockDelegation({ kind });
    await addOneDelegation(delegation);

    const notFoundId = generateId<DelegationId>();
    const expectedDelegation = delegationService.getDelegationById(
      notFoundId,
      genericLogger
    );

    await expect(expectedDelegation).rejects.toThrow(
      delegationNotFound(notFoundId)
    );
  };
});
