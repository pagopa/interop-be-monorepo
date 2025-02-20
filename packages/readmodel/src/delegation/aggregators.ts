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
} from "pagopa-interop-readmodel-models";

export const aggregateDelegation = ({
  delegationSQL,
  delegationStampsSQL,
  delegationContractDocumentsSQL,
}: {
  delegationSQL: DelegationSQL;
  delegationStampsSQL: DelegationStampSQL[];
  delegationContractDocumentsSQL: DelegationContractDocumentSQL[];
}): WithMetadata<Delegation> => {
  const activationContractDocumentSQL = delegationContractDocumentsSQL.find(
    (contractDoc) => contractDoc.kind === delegationContractKind.activation
  );
  const activationContract: DelegationContractDocument | undefined =
    activationContractDocumentSQL
      ? delegationContractDocumentSQLToDelegationContractDocument(
          activationContractDocumentSQL
        )
      : undefined;
  console.log(
    "activationContract",
    activationContract ? "true activation" : "false act"
  );
  const revocationContractDocumentSQL = delegationContractDocumentsSQL.find(
    (contractDoc) => contractDoc.kind === delegationContractKind.revocation
  );

  const revocationContract: DelegationContractDocument | undefined =
    revocationContractDocumentSQL
      ? delegationContractDocumentSQLToDelegationContractDocument(
          revocationContractDocumentSQL
        )
      : undefined;
  console.log("revocationContract", revocationContract);
  const submissionStampSQL = delegationStampsSQL.find(
    (stamp) => stamp.kind === delegationStampKind.submission
  );

  if (!submissionStampSQL) {
    throw genericInternalError("submissions stamp can't be missing");
  }

  const activationStampSQL = delegationStampsSQL.find(
    (stamp) => stamp.kind === delegationStampKind.activation
  );
  const rejectionStampSQL = delegationStampsSQL.find(
    (stamp) => stamp.kind === delegationStampKind.rejection
  );
  const revocationStampSQL = delegationStampsSQL.find(
    (stamp) => stamp.kind === delegationStampKind.revocation
  );

  const delegation: Delegation = {
    id: unsafeBrandId<DelegationId>(delegationSQL.id),
    createdAt: stringToDate(delegationSQL.createdAt),
    updatedAt: stringToDate(delegationSQL.updatedAt),
    eserviceId: unsafeBrandId<EServiceId>(delegationSQL.eserviceId),
    state: DelegationState.parse(delegationSQL.state),
    kind: DelegationKind.parse(delegationSQL.kind),
    delegatorId: unsafeBrandId<TenantId>(delegationSQL.delegatorId),
    delegateId: unsafeBrandId<TenantId>(delegationSQL.delegateId),
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
    ...(delegationSQL.rejectionReason
      ? { rejectionReason: delegationSQL.rejectionReason }
      : {}),
  };
  return {
    data: delegation,
    metadata: {
      version: 1,
    },
  };
};

export const aggregateDelegationsArray = ({
  delegationsSQL,
  delegationStampsSQL,
  delegationContractDocumentsSQL,
}: {
  delegationsSQL: DelegationSQL[];
  delegationStampsSQL: DelegationStampSQL[];
  delegationContractDocumentsSQL: DelegationContractDocumentSQL[];
}): Array<WithMetadata<Delegation>> =>
  delegationsSQL.map((delegationSQL) => {
    const stampsSQLOfCurrentDelegation = delegationStampsSQL.filter(
      (stampSQL) => stampSQL.delegationId === delegationSQL.id
    );

    const contractDocumentsSQLOfCurrentDelegation =
      delegationContractDocumentsSQL.filter(
        (docSQL) => docSQL.delegationId === delegationSQL.id
      );

    return aggregateDelegation({
      delegationSQL,
      delegationStampsSQL: stampsSQLOfCurrentDelegation,
      delegationContractDocumentsSQL: contractDocumentsSQLOfCurrentDelegation,
    });
  });

const delegationContractDocumentSQLToDelegationContractDocument = (
  delegationContractDocument: DelegationContractDocumentSQL
): DelegationContractDocument => ({
  id: unsafeBrandId<DelegationContractId>(delegationContractDocument.id),
  path: delegationContractDocument.path,
  name: delegationContractDocument.name,
  prettyName: delegationContractDocument.prettyName,
  contentType: delegationContractDocument.contentType,
  createdAt: stringToDate(delegationContractDocument.createdAt),
});

const stampSQLToStamp = (stampSQL: DelegationStampSQL): DelegationStamp => ({
  who: unsafeBrandId<UserId>(stampSQL.who),
  when: stringToDate(stampSQL.when),
});
