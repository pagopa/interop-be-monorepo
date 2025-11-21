import {
  getMockDelegation,
  getMockDelegationDocument,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  delegationKind,
  EServiceId,
  generateId,
  TenantId,
  UserId,
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
        updatedAt: new Date(),
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
      stampsSQL,
      contractDocumentsSQL,
      contractSignedDocumentsSQL,
    } = splitDelegationIntoObjectsSQL(delegation.data, 1);

    const aggregatedDelegation = aggregateDelegation({
      delegationSQL,
      stampsSQL,
      contractDocumentsSQL,
      contractSignedDocumentsSQL,
    });

    expect(aggregatedDelegation).toMatchObject(delegation);
  });

  it("should convert incomplete delegation SQL objects into a business logic delegation (null -> undefined)", () => {
    const delegation: WithMetadata<Delegation> = {
      data: {
        kind: delegationKind.delegatedProducer,
        id: generateId<DelegationId>(),
        delegatorId: generateId<TenantId>(),
        delegateId: generateId<TenantId>(),
        eserviceId: generateId<EServiceId>(),
        state: "WaitingForApproval",
        createdAt: new Date(),
        stamps: {
          submission: {
            who: generateId<UserId>(),
            when: new Date(),
          },
        },
      },
      metadata: {
        version: 1,
      },
    };

    const {
      delegationSQL,
      stampsSQL,
      contractDocumentsSQL,
      contractSignedDocumentsSQL,
    } = splitDelegationIntoObjectsSQL(delegation.data, 1);

    const aggregatedDelegation = aggregateDelegation({
      delegationSQL,
      stampsSQL,
      contractDocumentsSQL,
      contractSignedDocumentsSQL,
    });

    expect(aggregatedDelegation).toMatchObject(delegation);
  });
});
