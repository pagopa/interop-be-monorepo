/* eslint-disable functional/no-let */
import { expect, describe, it } from "vitest";
import { TenantId, generateId } from "pagopa-interop-models";
import {
  addOneDelegation,
  delegationService,
  getMockDelegation,
} from "./utils.js";

describe("get delegations", () => {
  it("should get delegations", async () => {
    const delegation1 = getMockDelegation({ state: "Active" });
    const delegation2 = getMockDelegation({
      delegateId: generateId<TenantId>(),
    });

    await addOneDelegation(delegation1);
    await addOneDelegation(delegation2);

    const res1 = await delegationService.getDelegations(
      [],
      [],
      ["Active"],
      0,
      50
    );

    expect(res1).toEqual([delegation1]);

    const res2 = await delegationService.getDelegations(
      [delegation2.delegateId],
      [],
      [],
      0,
      50
    );

    expect(res2).toEqual([delegation2]);
  });
});
