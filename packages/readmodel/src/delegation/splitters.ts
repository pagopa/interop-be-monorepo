import {
  dateToString,
  Delegation,
  DelegationContractDocument,
  delegationContractKind,
  DelegationContractKind,
  DelegationId,
  DelegationStamp,
  delegationStampKind,
  DelegationStampKind,
  DelegationStamps,
} from "pagopa-interop-models";
import {
  DelegationContractDocumentSQL,
  DelegationSQL,
  DelegationStampSQL,
} from "../types.js";

export const splitDelegationIntoObjectsSQL = (
  {
    id,
    delegatorId,
    delegateId,
    eserviceId,
    createdAt,
    submittedAt,
    approvedAt,
    rejectedAt,
    rejectionReason,
    revokedAt,
    state,
    kind,
    activationContract,
    revocationContract,
    stamps,
    ...rest
  }: Delegation,
  metadataVersion: number
): {
  delegationSQL: DelegationSQL;
  delegationStampsSQL: DelegationStampSQL[];
  delegationContractDocumentsSQL: DelegationContractDocumentSQL[];
} => {
  void (rest satisfies Record<string, never>);

  const delegationSQL: DelegationSQL = {
    id,
    metadataVersion,
    delegatorId,
    delegateId,
    eserviceId,
    createdAt: dateToString(createdAt),
    submittedAt: dateToString(submittedAt),
    approvedAt: dateToString(approvedAt),
    rejectedAt: dateToString(rejectedAt),
    rejectionReason: rejectionReason || null,
    revokedAt: dateToString(revokedAt),
    state,
    kind,
  };

  const delegationContractDocumentsSQL: DelegationContractDocumentSQL[] = [];

  if (activationContract) {
    const activationContractSQL =
      delegationContractDocumentToDelegationContractDocumentSQL(
        activationContract,
        id,
        metadataVersion,
        delegationContractKind.activation
      );
    // eslint-disable-next-line functional/immutable-data
    delegationContractDocumentsSQL.push(activationContractSQL);
  }

  if (revocationContract) {
    const revocationContractSQL =
      delegationContractDocumentToDelegationContractDocumentSQL(
        revocationContract,
        id,
        metadataVersion,
        delegationContractKind.revocation
      );
    // eslint-disable-next-line functional/immutable-data
    delegationContractDocumentsSQL.push(revocationContractSQL);
  }

  const delegationStampsSQL: DelegationStampSQL[] = [];

  const makeStampSQL = (
    { who, when, ...rest }: DelegationStamp,
    delegationId: DelegationId,
    metadataVersion: number,
    kind: DelegationStampKind
  ): DelegationStampSQL => {
    void (rest satisfies Record<string, never>);
    return {
      delegationId,
      metadataVersion,
      kind,
      who,
      when: dateToString(when),
    };
  };

  // TODO: improve?
  // eslint-disable-next-line functional/no-let
  let key: keyof DelegationStamps;

  // eslint-disable-next-line guard-for-in
  for (key in stamps) {
    const stamp = stamps[key];
    if (stamp) {
      // eslint-disable-next-line functional/immutable-data
      delegationStampsSQL.push(
        makeStampSQL(stamp, id, metadataVersion, delegationStampKind[key])
      );
    }
  }
  return {
    delegationSQL,
    delegationContractDocumentsSQL,
    delegationStampsSQL,
  };
};

const delegationContractDocumentToDelegationContractDocumentSQL = (
  {
    id,
    name,
    prettyName,
    contentType,
    path,
    createdAt,
    ...rest
  }: DelegationContractDocument,
  delegationId: DelegationId,
  metadataVersion: number,
  delegationContractKind: DelegationContractKind
): DelegationContractDocumentSQL => {
  void (rest satisfies Record<string, never>);

  return {
    id,
    delegationId,
    metadataVersion,
    name,
    kind: delegationContractKind,
    prettyName,
    contentType,
    path,
    createdAt: dateToString(createdAt),
  };
};
