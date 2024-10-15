/* eslint-disable functional/no-let */
import { getMockDelegationProducer } from "pagopa-interop-commons-test/index.js";
import { describe, expect, it } from "vitest";
import { addOneDelegation, delegationService } from "./utils.js";

describe("get delegations", () => {
  it("should get delegations", async () => {
    const delegation1 = getMockDelegationProducer({ state: "Active" });
    const delegation2 = getMockDelegationProducer();
    await addOneDelegation(delegation1);
    await addOneDelegation(delegation2);

    // non funziona
    const res1 = await delegationService.getDelegations(
      [],
      [],
      ["Active"],
      "DelegatedProducer",
      0,
      50
    );
    expect(res1).toEqual([delegation1]);

    const res2 = await delegationService.getDelegations(
      [delegation2.delegateId],
      [],
      [],
      "DelegatedProducer",
      0,
      50
    );
    expect(res2).toEqual([delegation2]);

    const res3 = await delegationService.getDelegations(
      [],
      [],
      ["Revoked"],
      "DelegatedProducer",
      0,
      50
    );
    expect(res3).toEqual([]);

    const res4 = await delegationService.getDelegations(
      [],
      [],
      ["Active"],
      undefined,
      0,
      50
    );
    expect(res4).toEqual([delegation1]);
  });
});
