import {
  dateToString,
  Delegation,
  DelegationContractDocument,
  delegationContractKind,
  DelegationContractKind,
  DelegationId,
  DelegationSignedContractDocument,
  DelegationStamp,
  DelegationStampKind,
} from "pagopa-interop-models";
import {
  DelegationContractDocumentSQL,
  DelegationItemsSQL,
  DelegationSignedContractDocumentSQL,
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
    activationSignedContract,
    revocationSignedContract,
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
  };

  const contractDocumentsSQL: DelegationContractDocumentSQL[] = [];
  const contractSignedDocumentsSQL: DelegationSignedContractDocumentSQL[] = [];

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

  if (activationSignedContract) {
    const activationSignedContractSQL =
      delegationSignedContractDocumentToDelegationSignedContractDocumentSQL(
        activationSignedContract,
        id,
        metadataVersion,
        delegationContractKind.activation
      );
    // eslint-disable-next-line functional/immutable-data
    contractSignedDocumentsSQL.push(activationSignedContractSQL);
  }

  if (revocationSignedContract) {
    const revocationSignedContractSQL =
      delegationSignedContractDocumentToDelegationSignedContractDocumentSQL(
        revocationSignedContract,
        id,
        metadataVersion,
        delegationContractKind.revocation
      );
    // eslint-disable-next-line functional/immutable-data
    contractSignedDocumentsSQL.push(revocationSignedContractSQL);
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
    contractSignedDocumentsSQL,
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
const delegationSignedContractDocumentToDelegationSignedContractDocumentSQL = (
  {
    id,
    name,
    prettyName,
    contentType,
    path,
    createdAt,
    signedAt,
    ...rest
  }: DelegationSignedContractDocument,
  delegationId: DelegationId,
  metadataVersion: number,
  delegationContractKind: DelegationContractKind
): DelegationSignedContractDocumentSQL => {
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
