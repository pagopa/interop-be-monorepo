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
  delegationSQL,
  stampsSQL,
  contractDocumentsSQL,
}: DelegationItemsSQL): WithMetadata<Delegation> => {
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
      version: delegationSQL.metadataVersion,
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

const delegationContractDocumentSQLToDelegationContractDocument = (
  contractDocumentSQL: DelegationContractDocumentSQL
): DelegationContractDocument => ({
  id: unsafeBrandId<DelegationContractId>(contractDocumentSQL.id),
  path: contractDocumentSQL.path,
  name: contractDocumentSQL.name,
  prettyName: contractDocumentSQL.prettyName,
  contentType: contractDocumentSQL.contentType,
  createdAt: stringToDate(contractDocumentSQL.createdAt),
});

const stampSQLToStamp = (stampSQL: DelegationStampSQL): DelegationStamp => ({
  who: unsafeBrandId<UserId>(stampSQL.who),
  when: stringToDate(stampSQL.when),
});

export const toDelegationAggregator = (
  queryRes: Array<{
    delegation: DelegationSQL;
    delegationStamp: DelegationStampSQL | null;
    delegationContractDocument: DelegationContractDocumentSQL | null;
  }>
): DelegationItemsSQL => {
  const { delegationsSQL, stampsSQL, contractDocumentsSQL } =
    toDelegationAggregatorArray(queryRes);

  return {
    delegationSQL: delegationsSQL[0],
    stampsSQL,
    contractDocumentsSQL,
  };
};

export const toDelegationAggregatorArray = (
  queryRes: Array<{
    delegation: DelegationSQL;
    delegationStamp: DelegationStampSQL | null;
    delegationContractDocument: DelegationContractDocumentSQL | null;
  }>
): {
  delegationsSQL: DelegationSQL[];
  stampsSQL: DelegationStampSQL[];
  contractDocumentsSQL: DelegationContractDocumentSQL[];
} => {
  const delegationIdSet = new Set<string>();
  const delegationsSQL: DelegationSQL[] = [];

  const delegationStampsIdSet = new Set<[string, string]>();
  const stampsSQL: DelegationStampSQL[] = [];

  const delegationContractDocumentsIdSet = new Set<string>();
  const contractDocumentsSQL: DelegationContractDocumentSQL[] = [];

  queryRes.forEach((row) => {
    const delegationSQL = row.delegation;
    if (!delegationIdSet.has(delegationSQL.id)) {
      delegationIdSet.add(delegationSQL.id);
      // eslint-disable-next-line functional/immutable-data
      delegationsSQL.push(delegationSQL);
    }

    const delegationStamp = row.delegationStamp;
    if (
      delegationStamp &&
      !delegationStampsIdSet.has([
        delegationStamp.delegationId,
        delegationStamp.kind,
      ])
    ) {
      delegationStampsIdSet.add([
        delegationStamp.delegationId,
        delegationStamp.kind,
      ]);
      // eslint-disable-next-line functional/immutable-data
      stampsSQL.push(delegationStamp);
    }

    const delegationContractDocumentSQL = row.delegationContractDocument;
    if (
      delegationContractDocumentSQL &&
      !delegationContractDocumentsIdSet.has(delegationContractDocumentSQL.id)
    ) {
      delegationContractDocumentsIdSet.add(delegationContractDocumentSQL.id);
      // eslint-disable-next-line functional/immutable-data
      contractDocumentsSQL.push(delegationContractDocumentSQL);
    }
  });

  return {
    delegationsSQL,
    stampsSQL,
    contractDocumentsSQL,
  };
};
