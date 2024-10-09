/* eslint-disable functional/no-let */
import { expect, describe, it } from "vitest";
import {
  addOneDelegation,
  delegationService,
  getMockDelegation,
} from "./utils.js";

describe("get delegation by id", () => {
  it("should get the delegation if it exists", async () => {
    const delegation = getMockDelegation();

    await addOneDelegation(delegation);

    const expectedDelegation = await delegationService.getDelegationById(
      delegation.id
    );

    expect(delegation).toEqual(expectedDelegation);
  });
});
