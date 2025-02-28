import {
  Delegation,
  DelegationContractDocument,
  DelegationContractId,
  delegationContractKind,
  DelegationId,
  DelegationKind,
  DelegationStamp,
  delegationStampKind,
  DelegationState,
  EServiceId,
  genericInternalError,
  stringToDate,
  TenantId,
  unsafeBrandId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DelegationSQL,
  DelegationStampSQL,
  DelegationContractDocumentSQL,
  DelegationItemsSQL,
} from "pagopa-interop-readmodel-models";

export const aggregateDelegationArray = ({
  delegationSQL,
  stampsSQL,
  contractDocumentsSQL,
}: {
  delegationSQL: DelegationSQL[];
  stampsSQL: DelegationStampSQL[];
  contractDocumentsSQL: DelegationContractDocumentSQL[];
}): Array<WithMetadata<Delegation>> =>
  delegationSQL.map((delegationSQL) =>
    aggregateDelegation({
      delegationSQL,
      stampsSQL: stampsSQL.filter(
        (stampSQL) => stampSQL.delegationId === delegationSQL.id
      ),
      contractDocumentsSQL: contractDocumentsSQL.filter(
        (docSQL) => docSQL.delegationId === delegationSQL.id
      ),
    })
  );

export const aggregateDelegation = ({
  delegationSQL: {
    id,
    delegatorId,
    delegateId,
    eserviceId,
    createdAt,
    updatedAt,
    rejectionReason,
    state,
    kind,
    metadataVersion,
    ...rest
  },
  stampsSQL,
  contractDocumentsSQL,
}: DelegationItemsSQL): WithMetadata<Delegation> => {
  void (rest satisfies Record<string, never>);

  const activationContractDocumentSQL = contractDocumentsSQL.find(
    (contractDoc) => contractDoc.kind === delegationContractKind.activation
  );
  const activationContract: DelegationContractDocument | undefined =
    activationContractDocumentSQL
      ? delegationContractDocumentSQLToDelegationContractDocument(
          activationContractDocumentSQL
        )
      : undefined;

  const revocationContractDocumentSQL = contractDocumentsSQL.find(
    (contractDoc) => contractDoc.kind === delegationContractKind.revocation
  );

  const revocationContract: DelegationContractDocument | undefined =
    revocationContractDocumentSQL
      ? delegationContractDocumentSQLToDelegationContractDocument(
          revocationContractDocumentSQL
        )
      : undefined;

  const submissionStampSQL = stampsSQL.find(
    (stamp) => stamp.kind === delegationStampKind.submission
  );

  if (!submissionStampSQL) {
    throw genericInternalError("submissions stamp can't be missing");
  }

  const activationStampSQL = stampsSQL.find(
    (stamp) => stamp.kind === delegationStampKind.activation
  );
  const rejectionStampSQL = stampsSQL.find(
    (stamp) => stamp.kind === delegationStampKind.rejection
  );
  const revocationStampSQL = stampsSQL.find(
    (stamp) => stamp.kind === delegationStampKind.revocation
  );

  const delegation: Delegation = {
    id: unsafeBrandId<DelegationId>(id),
    createdAt: stringToDate(createdAt),
    updatedAt: stringToDate(updatedAt),
    eserviceId: unsafeBrandId<EServiceId>(eserviceId),
    state: DelegationState.parse(state),
    kind: DelegationKind.parse(kind),
    delegatorId: unsafeBrandId<TenantId>(delegatorId),
    delegateId: unsafeBrandId<TenantId>(delegateId),
    stamps: {
      submission: stampSQLToStamp(submissionStampSQL),
      ...(activationStampSQL
        ? { activation: stampSQLToStamp(activationStampSQL) }
        : {}),
      ...(rejectionStampSQL
        ? { rejection: stampSQLToStamp(rejectionStampSQL) }
        : {}),
      ...(revocationStampSQL
        ? { revocation: stampSQLToStamp(revocationStampSQL) }
        : {}),
    },
    ...(activationContract ? { activationContract } : {}),
    ...(revocationContract ? { revocationContract } : {}),
    ...(rejectionReason ? { rejectionReason } : {}),
  };
  return {
    data: delegation,
    metadata: {
      version: metadataVersion,
    },
  };
};

export const aggregateDelegationsArray = ({
  delegationsSQL,
  stampsSQL,
  contractDocumentsSQL,
}: {
  delegationsSQL: DelegationSQL[];
  stampsSQL: DelegationStampSQL[];
  contractDocumentsSQL: DelegationContractDocumentSQL[];
}): Array<WithMetadata<Delegation>> =>
  delegationsSQL.map((delegationSQL) => {
    const stampsSQLOfCurrentDelegation = stampsSQL.filter(
      (stampSQL) => stampSQL.delegationId === delegationSQL.id
    );

    const contractDocumentsSQLOfCurrentDelegation = contractDocumentsSQL.filter(
      (docSQL) => docSQL.delegationId === delegationSQL.id
    );

    return aggregateDelegation({
      delegationSQL,
      stampsSQL: stampsSQLOfCurrentDelegation,
      contractDocumentsSQL: contractDocumentsSQLOfCurrentDelegation,
    });
  });

const delegationContractDocumentSQLToDelegationContractDocument = ({
  id,
  path,
  name,
  prettyName,
  contentType,
  createdAt,
  ...rest
}: Omit<
  DelegationContractDocumentSQL,
  "delegationId" | "metadataVersion" | "kind"
>): DelegationContractDocument => {
  void (rest satisfies Record<string, never>);

  return {
    id: unsafeBrandId<DelegationContractId>(id),
    path,
    name,
    prettyName,
    contentType,
    createdAt: stringToDate(createdAt),
  };
};

const stampSQLToStamp = ({
  who,
  when,
  ...rest
}: Omit<
  DelegationStampSQL,
  "delegationId" | "metadataVersion" | "kind"
>): DelegationStamp => {
  void (rest satisfies Record<string, never>);

  return {
    who: unsafeBrandId<UserId>(who),
    when: stringToDate(when),
  };
};
