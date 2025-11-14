import {
  Delegation,
  DelegationContractDocument,
  delegationContractKind,
  DelegationId,
  DelegationKind,
  DelegationSignedContractDocument,
  DelegationStamp,
  DelegationStampKind,
  DelegationState,
  genericInternalError,
  stringToDate,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DelegationSQL,
  DelegationStampSQL,
  DelegationContractDocumentSQL,
  DelegationItemsSQL,
  DelegationSignedContractDocumentSQL,
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";

export const aggregateDelegationArray = ({
  delegationsSQL,
  stampsSQL,
  contractDocumentsSQL,
  contractSignedDocumentsSQL,
}: {
  delegationsSQL: DelegationSQL[];
  stampsSQL: DelegationStampSQL[];
  contractDocumentsSQL: DelegationContractDocumentSQL[];
  contractSignedDocumentsSQL: DelegationSignedContractDocumentSQL[];
}): Array<WithMetadata<Delegation>> => {
  const stampsSQLByDelegationId = createDelegationSQLPropertyMap(stampsSQL);
  const contractDocumentsByDelegationId =
    createDelegationSQLPropertyMap(contractDocumentsSQL);
  const contractSignedDocumentsByDelegationId = createDelegationSQLPropertyMap(
    contractSignedDocumentsSQL
  );

  return delegationsSQL.map((delegationSQL) => {
    const delegationId = unsafeBrandId<DelegationId>(delegationSQL.id);
    return aggregateDelegation({
      delegationSQL,
      stampsSQL: stampsSQLByDelegationId.get(delegationId) || [],
      contractDocumentsSQL:
        contractDocumentsByDelegationId.get(delegationId) || [],
      contractSignedDocumentsSQL:
        contractSignedDocumentsByDelegationId.get(delegationId) || [],
    });
  });
};

const createDelegationSQLPropertyMap = <
  T extends DelegationStampSQL | DelegationContractDocumentSQL
>(
  items: T[]
): Map<DelegationId, T[]> =>
  items.reduce((acc, item) => {
    const delegationId = unsafeBrandId<DelegationId>(item.delegationId);
    const values = acc.get(delegationId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(delegationId, values);

    return acc;
  }, new Map<DelegationId, T[]>());

export const aggregateDelegation = ({
  delegationSQL,
  stampsSQL,
  contractDocumentsSQL,
  contractSignedDocumentsSQL,
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

  const activationSignedContractDocumentSQL = contractSignedDocumentsSQL.find(
    (contractSignedDoc) =>
      contractSignedDoc.kind === delegationContractKind.activation
  );
  const activationSignedContract: DelegationSignedContractDocument | undefined =
    activationSignedContractDocumentSQL
      ? delegationSignedContractDocumentSQLToDelegationSignedContractDocument(
          activationSignedContractDocumentSQL
        )
      : undefined;

  const revocationSignedContractDocumentSQL = contractSignedDocumentsSQL.find(
    (contractSignedDoc) =>
      contractSignedDoc.kind === delegationContractKind.revocation
  );

  const revocationSignedContract: DelegationSignedContractDocument | undefined =
    revocationSignedContractDocumentSQL
      ? delegationSignedContractDocumentSQLToDelegationSignedContractDocument(
          revocationSignedContractDocumentSQL
        )
      : undefined;

  const {
    submission: submissionStampSQL,
    activation: activationStampSQL,
    rejection: rejectionStampSQL,
    revocation: revocationStampSQL,
  } = stampsSQL.reduce(
    (acc: { [key in DelegationStampKind]?: DelegationStampSQL }, stamp) =>
      match(DelegationStampKind.parse(stamp.kind))
        .with(DelegationStampKind.enum.submission, () => ({
          ...acc,
          submission: stamp,
        }))
        .with(DelegationStampKind.enum.activation, () => ({
          ...acc,
          activation: stamp,
        }))
        .with(DelegationStampKind.enum.rejection, () => ({
          ...acc,
          rejection: stamp,
        }))
        .with(DelegationStampKind.enum.revocation, () => ({
          ...acc,
          revocation: stamp,
        }))
        .exhaustive(),
    {}
  );

  if (!submissionStampSQL) {
    throw genericInternalError("Delegation submission stamp can't be missing");
  }

  const delegation: Delegation = {
    id: unsafeBrandId(delegationSQL.id),
    createdAt: stringToDate(delegationSQL.createdAt),
    ...(delegationSQL.updatedAt
      ? { updatedAt: stringToDate(delegationSQL.updatedAt) }
      : {}),
    eserviceId: unsafeBrandId(delegationSQL.eserviceId),
    state: DelegationState.parse(delegationSQL.state),
    kind: DelegationKind.parse(delegationSQL.kind),
    delegatorId: unsafeBrandId(delegationSQL.delegatorId),
    delegateId: unsafeBrandId(delegationSQL.delegateId),
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
    ...(activationSignedContract ? { activationSignedContract } : {}),
    ...(revocationSignedContract ? { revocationSignedContract } : {}),
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
  contractSignedDocumentsSQL,
}: {
  delegationsSQL: DelegationSQL[];
  stampsSQL: DelegationStampSQL[];
  contractDocumentsSQL: DelegationContractDocumentSQL[];
  contractSignedDocumentsSQL: DelegationSignedContractDocumentSQL[];
}): Array<WithMetadata<Delegation>> => {
  const stampsSQLByDelegationId = createDelegationSQLPropertyMap(stampsSQL);
  const contractDocumentsByDelegationId =
    createDelegationSQLPropertyMap(contractDocumentsSQL);
  const contractSignedDocumentsByDelegationId = createDelegationSQLPropertyMap(
    contractSignedDocumentsSQL
  );

  return delegationsSQL.map((delegationSQL) => {
    const delegationId = unsafeBrandId<DelegationId>(delegationSQL.id);
    const stampsSQLOfCurrentDelegation =
      stampsSQLByDelegationId.get(delegationId) || [];

    const contractDocumentsSQLOfCurrentDelegation =
      contractDocumentsByDelegationId.get(delegationId) || [];

    const contractSignedDocumentsSQLOfCurrentDelegation =
      contractSignedDocumentsByDelegationId.get(delegationId) || [];

    return aggregateDelegation({
      delegationSQL,
      stampsSQL: stampsSQLOfCurrentDelegation,
      contractDocumentsSQL: contractDocumentsSQLOfCurrentDelegation,
      contractSignedDocumentsSQL: contractSignedDocumentsSQLOfCurrentDelegation,
    });
  });
};
const delegationContractDocumentSQLToDelegationContractDocument = (
  contractDocumentSQL: DelegationContractDocumentSQL
): DelegationContractDocument => ({
  id: unsafeBrandId(contractDocumentSQL.id),
  path: contractDocumentSQL.path,
  name: contractDocumentSQL.name,
  prettyName: contractDocumentSQL.prettyName,
  contentType: contractDocumentSQL.contentType,
  createdAt: stringToDate(contractDocumentSQL.createdAt),
});
const delegationSignedContractDocumentSQLToDelegationSignedContractDocument = (
  contractDocumentSQL: DelegationSignedContractDocumentSQL
): DelegationSignedContractDocument => ({
  id: unsafeBrandId(contractDocumentSQL.id),
  path: contractDocumentSQL.path,
  name: contractDocumentSQL.name,
  prettyName: contractDocumentSQL.prettyName,
  contentType: contractDocumentSQL.contentType,
  createdAt: stringToDate(contractDocumentSQL.createdAt),
  signedAt: stringToDate(contractDocumentSQL.signedAt),
});

const stampSQLToStamp = (stampSQL: DelegationStampSQL): DelegationStamp => ({
  who: unsafeBrandId(stampSQL.who),
  when: stringToDate(stampSQL.when),
});

export const toDelegationAggregator = (
  queryRes: Array<{
    delegation: DelegationSQL;
    delegationStamp: DelegationStampSQL | null;
    delegationContractDocument: DelegationContractDocumentSQL | null;
    delegationSignedContractDocument: DelegationSignedContractDocumentSQL | null;
  }>
): DelegationItemsSQL => {
  const {
    delegationsSQL,
    stampsSQL,
    contractDocumentsSQL,
    contractSignedDocumentsSQL,
  } = toDelegationAggregatorArray(queryRes);

  throwIfMultiple(delegationsSQL, "delegation");

  return {
    delegationSQL: delegationsSQL[0],
    stampsSQL,
    contractDocumentsSQL,
    contractSignedDocumentsSQL,
  };
};

export const toDelegationAggregatorArray = (
  queryRes: Array<{
    delegation: DelegationSQL;
    delegationStamp: DelegationStampSQL | null;
    delegationContractDocument: DelegationContractDocumentSQL | null;
    delegationSignedContractDocument: DelegationSignedContractDocumentSQL | null;
  }>
): {
  delegationsSQL: DelegationSQL[];
  stampsSQL: DelegationStampSQL[];
  contractDocumentsSQL: DelegationContractDocumentSQL[];
  contractSignedDocumentsSQL: DelegationSignedContractDocumentSQL[];
} => {
  const delegationIdSet = new Set<string>();
  const delegationsSQL: DelegationSQL[] = [];

  const delegationStampsIdSet = new Set<string>();
  const stampsSQL: DelegationStampSQL[] = [];

  const delegationContractDocumentsIdSet = new Set<string>();
  const contractDocumentsSQL: DelegationContractDocumentSQL[] = [];

  const delegationSignedContractDocumentsIdSet = new Set<string>();
  const contractSignedDocumentsSQL: DelegationSignedContractDocumentSQL[] = [];

  queryRes.forEach((row) => {
    const delegationSQL = row.delegation;
    if (!delegationIdSet.has(delegationSQL.id)) {
      delegationIdSet.add(delegationSQL.id);
      // eslint-disable-next-line functional/immutable-data
      delegationsSQL.push(delegationSQL);
    }

    const delegationStamp = row.delegationStamp;
    const delegationStampPK = delegationStamp
      ? makeUniqueKey([delegationStamp.delegationId, delegationStamp.kind])
      : undefined;
    if (
      delegationStamp &&
      delegationStampPK &&
      !delegationStampsIdSet.has(delegationStampPK)
    ) {
      delegationStampsIdSet.add(delegationStampPK);
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

    const delegationSignedContractDocumentSQL =
      row.delegationSignedContractDocument;
    if (
      delegationSignedContractDocumentSQL &&
      !delegationSignedContractDocumentsIdSet.has(
        delegationSignedContractDocumentSQL.id
      )
    ) {
      delegationSignedContractDocumentsIdSet.add(
        delegationSignedContractDocumentSQL.id
      );
      // eslint-disable-next-line functional/immutable-data
      contractSignedDocumentsSQL.push(delegationSignedContractDocumentSQL);
    }
  });

  return {
    delegationsSQL,
    stampsSQL,
    contractDocumentsSQL,
    contractSignedDocumentsSQL,
  };
};
