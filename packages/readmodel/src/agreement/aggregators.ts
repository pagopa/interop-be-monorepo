import {
  AgreementSQL,
  AgreementStampSQL,
  AgreementAttributeSQL,
  AgreementConsumerDocumentSQL,
  AgreementContractSQL,
  AgreementItemsSQL,
  AgreementSignedContractSQL,
} from "pagopa-interop-readmodel-models";
import {
  Agreement,
  unsafeBrandId,
  WithMetadata,
  AgreementState,
  stringToDate,
  attributeKind,
  AttributeId,
  AgreementDocument,
  AgreementStamp,
  DelegationId,
  AgreementStampKind,
  AgreementAttribute,
  AttributeKind,
  AgreementId,
  AgreementSignedContract,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";

export const aggregateAgreementArray = ({
  agreementsSQL,
  stampsSQL,
  consumerDocumentsSQL,
  contractsSQL,
  attributesSQL,
  signedContractsSQL,
}: {
  agreementsSQL: AgreementSQL[];
  stampsSQL: AgreementStampSQL[];
  consumerDocumentsSQL: AgreementConsumerDocumentSQL[];
  contractsSQL: AgreementContractSQL[];
  attributesSQL: AgreementAttributeSQL[];
  signedContractsSQL: AgreementSignedContractSQL[];
}): Array<WithMetadata<Agreement>> => {
  const stampsSQLByAgreementId = createAgreementSQLPropertyMap(stampsSQL);
  const consumerDocumentsSQLByAgreementId =
    createAgreementSQLPropertyMap(consumerDocumentsSQL);
  const contractsSQLByAgreementId = createAgreementSQLPropertyMap(contractsSQL);
  const attributesSQLByAgreementId =
    createAgreementSQLPropertyMap(attributesSQL);
  const signedContractsSQLByAgreementId =
    createAgreementSQLPropertyMap(signedContractsSQL);

  return agreementsSQL.map((agreementSQL) => {
    const agreementId = unsafeBrandId<AgreementId>(agreementSQL.id);
    return aggregateAgreement({
      agreementSQL,
      stampsSQL: stampsSQLByAgreementId.get(agreementId) || [],
      consumerDocumentsSQL:
        consumerDocumentsSQLByAgreementId.get(agreementId) || [],
      contractSQL: contractsSQLByAgreementId.get(agreementId)?.[0],
      attributesSQL: attributesSQLByAgreementId.get(agreementId) || [],
      signedContractSQL: signedContractsSQLByAgreementId.get(agreementId)?.[0],
    });
  });
};

const createAgreementSQLPropertyMap = <
  T extends
    | AgreementStampSQL
    | AgreementConsumerDocumentSQL
    | AgreementContractSQL
    | AgreementAttributeSQL
    | AgreementSignedContractSQL
>(
  items: T[]
): Map<AgreementId, T[]> =>
  items.reduce((acc, item) => {
    const agreementId = unsafeBrandId<AgreementId>(item.agreementId);
    const values = acc.get(agreementId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(agreementId, values);

    return acc;
  }, new Map<AgreementId, T[]>());

export const aggregateAgreement = ({
  agreementSQL,
  stampsSQL,
  consumerDocumentsSQL,
  contractSQL,
  attributesSQL,
  signedContractSQL,
}: AgreementItemsSQL): WithMetadata<Agreement> => {
  const { verifiedAttributes, certifiedAttributes, declaredAttributes } =
    attributesSQL.reduce(
      (
        acc: {
          verifiedAttributes: AgreementAttribute[];
          certifiedAttributes: AgreementAttribute[];
          declaredAttributes: AgreementAttribute[];
        },
        a
      ) =>
        match(AttributeKind.parse(a.kind))
          .with(attributeKind.verified, () => ({
            ...acc,
            verifiedAttributes: [
              ...acc.verifiedAttributes,
              { id: unsafeBrandId<AttributeId>(a.attributeId) },
            ],
          }))
          .with(attributeKind.certified, () => ({
            ...acc,
            certifiedAttributes: [
              ...acc.certifiedAttributes,
              { id: unsafeBrandId<AttributeId>(a.attributeId) },
            ],
          }))
          .with(attributeKind.declared, () => ({
            ...acc,
            declaredAttributes: [
              ...acc.declaredAttributes,
              { id: unsafeBrandId<AttributeId>(a.attributeId) },
            ],
          }))
          .exhaustive(),
      {
        verifiedAttributes: [],
        certifiedAttributes: [],
        declaredAttributes: [],
      }
    );

  const consumerDocuments: AgreementDocument[] = consumerDocumentsSQL.map(
    documentSQLtoDocument
  );

  const {
    submission: submissionStampSQL,
    activation: activationStampSQL,
    rejection: rejectionStampSQL,
    suspensionByProducer: suspensionByProducerStampSQL,
    suspensionByConsumer: suspensionByConsumerStampSQL,
    upgrade: upgradeStampSQL,
    archiving: archivingStampSQL,
  } = stampsSQL.reduce(
    (acc: { [key in AgreementStampKind]?: AgreementStampSQL }, stamp) =>
      match(AgreementStampKind.parse(stamp.kind))
        .with(AgreementStampKind.enum.submission, () => ({
          ...acc,
          submission: stamp,
        }))
        .with(AgreementStampKind.enum.activation, () => ({
          ...acc,
          activation: stamp,
        }))
        .with(AgreementStampKind.enum.rejection, () => ({
          ...acc,
          rejection: stamp,
        }))
        .with(AgreementStampKind.enum.suspensionByProducer, () => ({
          ...acc,
          suspensionByProducer: stamp,
        }))
        .with(AgreementStampKind.enum.suspensionByConsumer, () => ({
          ...acc,
          suspensionByConsumer: stamp,
        }))
        .with(AgreementStampKind.enum.upgrade, () => ({
          ...acc,
          upgrade: stamp,
        }))
        .with(AgreementStampKind.enum.archiving, () => ({
          ...acc,
          archiving: stamp,
        }))
        .exhaustive(),
    {}
  );

  const agreement: Agreement = {
    id: unsafeBrandId(agreementSQL.id),
    eserviceId: unsafeBrandId(agreementSQL.eserviceId),
    descriptorId: unsafeBrandId(agreementSQL.descriptorId),
    producerId: unsafeBrandId(agreementSQL.producerId),
    consumerId: unsafeBrandId(agreementSQL.consumerId),
    state: AgreementState.parse(agreementSQL.state),
    verifiedAttributes,
    certifiedAttributes,
    declaredAttributes,
    ...(agreementSQL.suspendedByConsumer !== null
      ? {
          suspendedByConsumer: agreementSQL.suspendedByConsumer,
        }
      : {}),
    ...(agreementSQL.suspendedByProducer !== null
      ? {
          suspendedByProducer: agreementSQL.suspendedByProducer,
        }
      : {}),
    ...(agreementSQL.suspendedByPlatform !== null
      ? {
          suspendedByPlatform: agreementSQL.suspendedByPlatform,
        }
      : {}),
    consumerDocuments,
    createdAt: stringToDate(agreementSQL.createdAt),
    ...(agreementSQL.updatedAt
      ? { updatedAt: stringToDate(agreementSQL.updatedAt) }
      : {}),
    ...(agreementSQL.consumerNotes !== null
      ? {
          consumerNotes: agreementSQL.consumerNotes,
        }
      : {}),
    ...(contractSQL ? { contract: documentSQLtoDocument(contractSQL) } : {}),
    stamps: {
      ...(submissionStampSQL
        ? { submission: stampSQLtoStamp(submissionStampSQL) }
        : {}),
      ...(activationStampSQL
        ? { activation: stampSQLtoStamp(activationStampSQL) }
        : {}),
      ...(rejectionStampSQL
        ? { rejection: stampSQLtoStamp(rejectionStampSQL) }
        : {}),
      ...(suspensionByProducerStampSQL
        ? {
            suspensionByProducer: stampSQLtoStamp(suspensionByProducerStampSQL),
          }
        : {}),
      ...(suspensionByConsumerStampSQL
        ? {
            suspensionByConsumer: stampSQLtoStamp(suspensionByConsumerStampSQL),
          }
        : {}),
      ...(upgradeStampSQL ? { upgrade: stampSQLtoStamp(upgradeStampSQL) } : {}),
      ...(archivingStampSQL
        ? { archiving: stampSQLtoStamp(archivingStampSQL) }
        : {}),
    },
    ...(agreementSQL.rejectionReason !== null
      ? {
          rejectionReason: agreementSQL.rejectionReason,
        }
      : {}),
    ...(agreementSQL.suspendedAt !== null
      ? {
          suspendedAt: stringToDate(agreementSQL.suspendedAt),
        }
      : {}),
    ...(signedContractSQL
      ? { signedContract: signeDocumentSQLtosignedDocument(signedContractSQL) }
      : {}),
  };

  return {
    data: agreement,
    metadata: { version: agreementSQL.metadataVersion },
  };
};

const documentSQLtoDocument = (
  documentSQL: AgreementContractSQL
): AgreementDocument => ({
  id: unsafeBrandId(documentSQL.id),
  path: documentSQL.path,
  name: documentSQL.name,
  prettyName: documentSQL.prettyName,
  contentType: documentSQL.contentType,
  createdAt: stringToDate(documentSQL.createdAt),
});

const signeDocumentSQLtosignedDocument = (
  documentSQL: AgreementSignedContractSQL
): AgreementSignedContract => ({
  id: unsafeBrandId(documentSQL.id),
  path: documentSQL.path,
  name: documentSQL.name,
  prettyName: documentSQL.prettyName,
  contentType: documentSQL.contentType,
  createdAt: stringToDate(documentSQL.createdAt),
  signedAt: stringToDate(documentSQL.signedAt),
});

const stampSQLtoStamp = (stampSQL: AgreementStampSQL): AgreementStamp => ({
  who: unsafeBrandId(stampSQL.who),
  when: stringToDate(stampSQL.when),
  ...(stampSQL.delegationId !== null
    ? {
        delegationId: unsafeBrandId<DelegationId>(stampSQL.delegationId),
      }
    : {}),
});

export const toAgreementAggregator = (
  queryRes: Array<{
    agreement: AgreementSQL;
    stamp: AgreementStampSQL | null;
    attribute: AgreementAttributeSQL | null;
    consumerDocument: AgreementConsumerDocumentSQL | null;
    contract: AgreementContractSQL | null;
    signedContract: AgreementSignedContractSQL | null;
  }>
): AgreementItemsSQL => {
  const {
    agreementsSQL,
    stampsSQL,
    attributesSQL,
    consumerDocumentsSQL,
    contractsSQL,
    signedContractsSQL,
  } = toAgreementAggregatorArray(queryRes);

  throwIfMultiple(agreementsSQL, "agreement");

  return {
    agreementSQL: agreementsSQL[0],
    stampsSQL,
    attributesSQL,
    consumerDocumentsSQL,
    contractSQL: contractsSQL.length > 0 ? contractsSQL[0] : undefined,
    signedContractSQL:
      signedContractsSQL.length > 0 ? signedContractsSQL[0] : undefined,
  };
};

export const toAgreementAggregatorArray = (
  queryRes: Array<{
    agreement: AgreementSQL;
    stamp: AgreementStampSQL | null;
    attribute: AgreementAttributeSQL | null;
    consumerDocument: AgreementConsumerDocumentSQL | null;
    contract: AgreementContractSQL | null;
    signedContract: AgreementSignedContractSQL | null;
  }>
): {
  agreementsSQL: AgreementSQL[];
  stampsSQL: AgreementStampSQL[];
  attributesSQL: AgreementAttributeSQL[];
  consumerDocumentsSQL: AgreementConsumerDocumentSQL[];
  contractsSQL: AgreementContractSQL[];
  signedContractsSQL: AgreementSignedContractSQL[];
} => {
  const agreementIdSet = new Set<string>();
  const agreementsSQL: AgreementSQL[] = [];

  const contractIdSet = new Set<string>();
  const contractsSQL: AgreementContractSQL[] = [];

  const stampIdSet = new Set<string>();
  const stampsSQL: AgreementStampSQL[] = [];

  const attributeIdSet = new Set<string>();
  const attributesSQL: AgreementAttributeSQL[] = [];

  const consumerDocumentIdSet = new Set<string>();
  const consumerDocumentsSQL: AgreementConsumerDocumentSQL[] = [];

  const signedContractIdSet = new Set<string>();
  const signedContractsSQL: AgreementSignedContractSQL[] = [];

  queryRes.forEach((row) => {
    const agreementSQL = row.agreement;
    if (!agreementIdSet.has(agreementSQL.id)) {
      agreementIdSet.add(agreementSQL.id);
      // eslint-disable-next-line functional/immutable-data
      agreementsSQL.push(agreementSQL);
    }

    const stampSQL = row.stamp;
    const stampPK = stampSQL
      ? makeUniqueKey([stampSQL.agreementId, stampSQL.kind])
      : undefined;
    if (stampSQL && stampPK && !stampIdSet.has(stampPK)) {
      stampIdSet.add(stampPK);
      // eslint-disable-next-line functional/immutable-data
      stampsSQL.push(stampSQL);
    }

    const attributeSQL = row.attribute;
    const attributePK = attributeSQL
      ? makeUniqueKey([attributeSQL.agreementId, attributeSQL.attributeId])
      : undefined;
    if (attributeSQL && attributePK && !attributeIdSet.has(attributePK)) {
      attributeIdSet.add(attributePK);
      // eslint-disable-next-line functional/immutable-data
      attributesSQL.push(attributeSQL);
    }

    const contractSQL = row.contract;
    const contractPK = contractSQL
      ? makeUniqueKey([contractSQL.agreementId, contractSQL.id])
      : undefined;
    if (contractSQL && contractPK && !contractIdSet.has(contractPK)) {
      contractIdSet.add(contractPK);
      // eslint-disable-next-line functional/immutable-data
      contractsSQL.push(contractSQL);
    }

    const signedContractSQL = row.signedContract;
    const signedContractPK = signedContractSQL
      ? makeUniqueKey([signedContractSQL.agreementId, signedContractSQL.id])
      : undefined;
    if (
      signedContractSQL &&
      signedContractPK &&
      !signedContractIdSet.has(signedContractPK)
    ) {
      signedContractIdSet.add(signedContractPK);
      // eslint-disable-next-line functional/immutable-data
      signedContractsSQL.push(signedContractSQL);
    }

    const documentSQL = row.consumerDocument;
    if (documentSQL && !consumerDocumentIdSet.has(documentSQL.id)) {
      consumerDocumentIdSet.add(documentSQL.id);
      // eslint-disable-next-line functional/immutable-data
      consumerDocumentsSQL.push(documentSQL);
    }
  });

  return {
    agreementsSQL,
    stampsSQL,
    attributesSQL,
    consumerDocumentsSQL,
    contractsSQL,
    signedContractsSQL,
  };
};
