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

    const res1 = await delegationService.getDelegations({
      delegateIds: [],
      delegatorIds: [],
      delegationStates: ["Active"],
      eserviceIds: [],
      kind: "DelegatedProducer",
      offset: 0,
      limit: 50,
    });
    expect(res1).toEqual([delegation1]);

    const res2 = await delegationService.getDelegations({
      delegateIds: [delegation2.delegateId],
      delegatorIds: [],
      delegationStates: [],
      eserviceIds: [],
      kind: "DelegatedProducer",
      offset: 0,
      limit: 50,
    });
    expect(res2).toEqual([delegation2]);

    const res3 = await delegationService.getDelegations({
      delegateIds: [],
      delegatorIds: [],
      delegationStates: ["Revoked"],
      eserviceIds: [],
      kind: "DelegatedProducer",
      offset: 0,
      limit: 50,
    });
    expect(res3).toEqual([]);

    const res4 = await delegationService.getDelegations({
      delegateIds: [],
      delegatorIds: [],
      delegationStates: ["Active"],
      eserviceIds: [],
      kind: undefined,
      offset: 0,
      limit: 50,
    });
    expect(res4).toEqual([delegation1]);

    const res5 = await delegationService.getDelegations({
      delegateIds: [],
      delegatorIds: [],
      delegationStates: ["Active"],
      eserviceIds: [delegation1.eserviceId],
      kind: "DelegatedProducer",
      offset: 0,
      limit: 50,
    });
    expect(res5).toEqual([delegation1]);
  });
});
