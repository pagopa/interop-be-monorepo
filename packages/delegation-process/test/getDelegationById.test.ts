/* eslint-disable functional/no-let */
import { getMockDelegationProducer } from "pagopa-interop-commons-test/index.js";
import { DelegationId, generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { delegationNotFound } from "../src/model/domain/errors.js";
import { addOneDelegation, delegationService } from "./utils.js";

describe("get delegation by id", () => {
  it("should get the delegation if it exists", async () => {
    const delegation = getMockDelegationProducer();

    await addOneDelegation(delegation);

    const expectedDelegation = await delegationService.getDelegationById(
      delegation.id
    );

    expect(delegation).toEqual(expectedDelegation);
  });

  it("should fail with delegationNotFound", async () => {
    const delegation = getMockDelegationProducer();

    await addOneDelegation(delegation);

    const notFoundId = generateId<DelegationId>();
    const expectedDelegation = delegationService.getDelegationById(notFoundId);

    await expect(expectedDelegation).rejects.toThrow(
      delegationNotFound(notFoundId)
    );
  });
});
