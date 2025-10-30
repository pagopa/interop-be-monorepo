import {
  dateToString,
  Delegation,
  DelegationContractDocument,
  delegationContractKind,
  DelegationContractKind,
  DelegationId,
  DelegationStamp,
  DelegationStampKind,
} from "pagopa-interop-models";
import {
  DelegationContractDocumentSQL,
  DelegationItemsSQL,
  DelegationSQL,
  DelegationStampSQL,
} from "pagopa-interop-readmodel-models";

export const splitDelegationIntoObjectsSQL = (
  {
    id,
    delegatorId,
    delegateId,
    eserviceId,
    createdAt,
    updatedAt,
    rejectionReason,
    state,
    kind,
    activationContract,
    revocationContract,
    stamps,
    signedContract,
    ...rest
  }: Delegation,
  metadataVersion: number
): DelegationItemsSQL => {
  void (rest satisfies Record<string, never>);

  const delegationSQL: DelegationSQL = {
    id,
    metadataVersion,
    delegatorId,
    delegateId,
    eserviceId,
    createdAt: dateToString(createdAt),
    updatedAt: dateToString(updatedAt),
    rejectionReason: rejectionReason || null,
    state,
    kind,
    signedContract: signedContract || null,
  };

  const contractDocumentsSQL: DelegationContractDocumentSQL[] = [];

  if (activationContract) {
    const activationContractSQL =
      delegationContractDocumentToDelegationContractDocumentSQL(
        activationContract,
        id,
        metadataVersion,
        delegationContractKind.activation
      );
    // eslint-disable-next-line functional/immutable-data
    contractDocumentsSQL.push(activationContractSQL);
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
    contractDocumentsSQL.push(revocationContractSQL);
  }

  const makeStampSQL = (
    { who, when, ...stampRest }: DelegationStamp,
    delegationId: DelegationId,
    metadataVersion: number,
    kind: DelegationStampKind
  ): DelegationStampSQL => {
    void (stampRest satisfies Record<string, never>);
    return {
      delegationId,
      metadataVersion,
      kind,
      who,
      when: dateToString(when),
    };
  };

  const stampsSQL: DelegationStampSQL[] = Object.entries(stamps)
    .filter((entry): entry is [DelegationStampKind, DelegationStamp] => {
      const [, stamp] = entry;
      return stamp !== undefined;
    })
    .map(([key, stamp]) => makeStampSQL(stamp, id, metadataVersion, key));

  return {
    delegationSQL,
    contractDocumentsSQL,
    stampsSQL,
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
    signedAt,
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
    signedAt: dateToString(signedAt),
  };
};
