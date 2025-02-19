/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  getMockDelegation,
  getMockDelegationDocument,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  delegationKind,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { splitDelegationIntoObjectsSQL } from "../src/delegation/splitters.js";
import { aggregateDelegation } from "../src/delegation/aggregators.js";

describe("Delegation aggregator", () => {
  it("should convert complete delegation SQL objects into a business logic delegation", () => {
    const delegation: WithMetadata<Delegation> = {
      data: {
        ...getMockDelegation({
          kind: delegationKind.delegatedProducer,
        }),
        approvedAt: new Date(),
        revokedAt: new Date(),
        rejectedAt: new Date(),
        rejectionReason: "Rejection reason",
        revocationContract: getMockDelegationDocument(),
        activationContract: getMockDelegationDocument(),
      },
      metadata: {
        version: 1,
      },
    };

    const {
      delegationSQL,
      delegationStampsSQL,
      delegationContractDocumentsSQL,
    } = splitDelegationIntoObjectsSQL(delegation.data, 1);

    const aggregatedDelegation = aggregateDelegation({
      delegationSQL,
      delegationStampsSQL,
      delegationContractDocumentsSQL,
    });

    expect(aggregatedDelegation).toEqual(delegation);
  });

  it("should convert incomplete delegation SQL objects into a business logic delegation (null -> undefined)", () => {
    const delegation: WithMetadata<Delegation> = {
      data: {
        ...getMockDelegation({
          kind: delegationKind.delegatedProducer,
        }),
      },
      metadata: {
        version: 1,
      },
    };

    const {
      delegationSQL,
      delegationStampsSQL,
      delegationContractDocumentsSQL,
    } = splitDelegationIntoObjectsSQL(delegation.data, 1);

    const aggregatedDelegation = aggregateDelegation({
      delegationSQL,
      delegationStampsSQL,
      delegationContractDocumentsSQL,
    });

    expect(aggregatedDelegation).toEqual(delegation);
  });
});
