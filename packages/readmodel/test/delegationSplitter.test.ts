/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockDelegation,
  getMockDelegationDocument,
  getMockDelegationSignedDocument,
} from "pagopa-interop-commons-test";
import {
  dateToString,
  Delegation,
  delegationContractKind,
  delegationKind,
  DelegationStampKind,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  DelegationContractDocumentSQL,
  DelegationSQL,
  DelegationSignedContractDocumentSQL,
  DelegationStampSQL,
} from "pagopa-interop-readmodel-models";
import { splitDelegationIntoObjectsSQL } from "../src/delegation/splitters.js";

describe("Delegation splitters", () => {
  it("should convert a complete delegation into delegation SQL objects", () => {
    const rejectionReason = "Rejection reason";
    const revocationContract = getMockDelegationDocument();
    const activationContract = getMockDelegationDocument();
    const revocationSignedContract = getMockDelegationSignedDocument();
    const activationSignedContract = getMockDelegationSignedDocument();
    const delegation: Delegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
      }),
      updatedAt: new Date(),
      rejectionReason,
      revocationContract,
      activationContract,
      revocationSignedContract,
      activationSignedContract,
    };

    const {
      delegationSQL,
      stampsSQL,
      contractDocumentsSQL,
      contractSignedDocumentsSQL,
    } = splitDelegationIntoObjectsSQL(delegation, 1);

    const expectedDelegationSQL: DelegationSQL = {
      metadataVersion: 1,
      createdAt: delegation.createdAt.toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      updatedAt: dateToString(delegation.updatedAt!),
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
      kind: DelegationStampKind.enum.submission,
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

    const expectedRevocationSignedContractDocument: DelegationSignedContractDocumentSQL =
      {
        ...revocationSignedContract,
        kind: delegationContractKind.revocation,
        metadataVersion: 1,
        delegationId: delegation.id,
        createdAt: revocationSignedContract.createdAt.toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        signedAt: revocationSignedContract.signedAt?.toISOString()!,
      };

    const expectedActivationSignedContractDocument: DelegationSignedContractDocumentSQL =
      {
        ...activationSignedContract,
        kind: delegationContractKind.activation,
        metadataVersion: 1,
        delegationId: delegation.id,
        createdAt: activationSignedContract.createdAt.toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        signedAt: activationSignedContract.signedAt?.toISOString()!,
      };

    expect(delegationSQL).toEqual(expectedDelegationSQL);
    expect(stampsSQL).toEqual([expectedDelegationStamps]);
    expect(contractDocumentsSQL).toEqual(
      expect.arrayContaining([
        expectedRevocationContractDocument,
        expectedActivationContractDocument,
      ])
    );
    expect(contractSignedDocumentsSQL).toEqual(
      expect.arrayContaining([
        expectedRevocationSignedContractDocument,
        expectedActivationSignedContractDocument,
      ])
    );
  });

  it("should convert an incomplete delegation into delegation SQL objects (undefined -> null)", () => {
    const delegation: Delegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
      }),
    };

    const { delegationSQL, stampsSQL, contractDocumentsSQL } =
      splitDelegationIntoObjectsSQL(delegation, 1);

    const expectedDelegationSQL: DelegationSQL = {
      metadataVersion: 1,
      createdAt: delegation.createdAt.toISOString(),
      updatedAt: null,
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
      kind: DelegationStampKind.enum.submission,
      metadataVersion: 1,
      delegationId: delegation.id,
      when: delegation.stamps.submission.when.toISOString(),
    };

    expect(delegationSQL).toEqual(expectedDelegationSQL);
    expect(stampsSQL).toEqual([expectedDelegationStamps]);
    expect(contractDocumentsSQL).toHaveLength(0);
  });
});
