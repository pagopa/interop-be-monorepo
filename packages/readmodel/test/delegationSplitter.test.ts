/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  getMockDelegation,
  getMockDelegationDocument,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  delegationContractKind,
  delegationKind,
  delegationStampKind,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  DelegationContractDocumentSQL,
  DelegationSQL,
  DelegationStampSQL,
} from "pagopa-interop-readmodel-models";
import { splitDelegationIntoObjectsSQL } from "../src/delegation/splitters.js";

describe("Delegation splitters", () => {
  it("should convert a complete delegation into delegation SQL objects", () => {
    const approvedAt = new Date();
    const revokedAt = new Date();
    const rejectedAt = new Date();
    const rejectionReason = "Rejection reason";
    const revocationContract = getMockDelegationDocument();
    const activationContract = getMockDelegationDocument();
    const delegation: Delegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
      }),
      approvedAt,
      revokedAt,
      rejectedAt,
      rejectionReason,
      revocationContract,
      activationContract,
    };

    const {
      delegationSQL,
      delegationStampsSQL,
      delegationContractDocumentsSQL,
    } = splitDelegationIntoObjectsSQL(delegation, 1);

    const expectedDelegationSQL: DelegationSQL = {
      metadataVersion: 1,
      createdAt: delegation.createdAt.toISOString(),
      submittedAt: delegation.submittedAt.toISOString(),
      approvedAt: approvedAt.toISOString(),
      revokedAt: revokedAt.toISOString(),
      rejectedAt: rejectedAt.toISOString(),
      rejectionReason,
      kind: delegation.kind,
      id: delegation.id,
      delegatorId: delegation.delegatorId,
      delegateId: delegation.delegateId,
      eserviceId: delegation.eserviceId,
      state: delegation.state,
    };

    const expectedDelegationStamps: DelegationStampSQL = {
      ...delegation.stamps.submission,
      kind: delegationStampKind.submission,
      metadataVersion: 1,
      delegationId: delegation.id,
      when: delegation.stamps.submission.when.toISOString(),
    };

    const expectedRevocationContractDocument: DelegationContractDocumentSQL = {
      ...revocationContract,
      kind: delegationContractKind.revocation,
      metadataVersion: 1,
      delegationId: delegation.id,
      createdAt: revocationContract.createdAt.toISOString(),
    };

    const expectedActivationContractDocument: DelegationContractDocumentSQL = {
      ...activationContract,
      kind: delegationContractKind.activation,
      metadataVersion: 1,
      delegationId: delegation.id,
      createdAt: activationContract.createdAt.toISOString(),
    };

    expect(delegationSQL).toEqual(expectedDelegationSQL);
    expect(delegationStampsSQL).toEqual([expectedDelegationStamps]);
    expect(delegationContractDocumentsSQL).toEqual(
      expect.arrayContaining([
        expectedRevocationContractDocument,
        expectedActivationContractDocument,
      ])
    );
  });

  it("should convert an incomplete delegation into delegation SQL objects (undefined -> null)", () => {
    const delegation: Delegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
      }),
    };

    const {
      delegationSQL,
      delegationStampsSQL,
      delegationContractDocumentsSQL,
    } = splitDelegationIntoObjectsSQL(delegation, 1);

    const expectedDelegationSQL: DelegationSQL = {
      metadataVersion: 1,
      createdAt: delegation.createdAt.toISOString(),
      submittedAt: delegation.submittedAt.toISOString(),
      approvedAt: null,
      revokedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      kind: delegation.kind,
      id: delegation.id,
      delegatorId: delegation.delegatorId,
      delegateId: delegation.delegateId,
      eserviceId: delegation.eserviceId,
      state: delegation.state,
    };

    const expectedDelegationStamps: DelegationStampSQL = {
      ...delegation.stamps.submission,
      kind: delegationStampKind.submission,
      metadataVersion: 1,
      delegationId: delegation.id,
      when: delegation.stamps.submission.when.toISOString(),
    };

    expect(delegationSQL).toEqual(expectedDelegationSQL);
    expect(delegationStampsSQL).toEqual([expectedDelegationStamps]);
    expect(delegationContractDocumentsSQL).toHaveLength(0);
  });
});
