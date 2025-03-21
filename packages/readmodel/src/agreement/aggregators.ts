import {
  AgreementSQL,
  AgreementStampSQL,
  AgreementAttributeSQL,
  AgreementConsumerDocumentSQL,
  AgreementContractSQL,
  AgreementItemsSQL,
} from "pagopa-interop-readmodel-models";
import {
  Agreement,
  AgreementId,
  unsafeBrandId,
  WithMetadata,
  EServiceId,
  TenantId,
  DescriptorId,
  AgreementState,
  stringToDate,
  attributeKind,
  AttributeId,
  AgreementDocument,
  AgreementDocumentId,
  AgreementStamp,
  UserId,
  DelegationId,
  AgreementStampKind,
  genericInternalError,
  AgreementAttribute,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { makeUniqueKey } from "../utils.js";

export const aggregateAgreementArray = ({
  agreementsSQL,
  stampsSQL,
  consumerDocumentsSQL,
  contractsSQL,
  attributesSQL,
}: {
  agreementsSQL: AgreementSQL[];
  stampsSQL: AgreementStampSQL[];
  consumerDocumentsSQL: AgreementConsumerDocumentSQL[];
  contractsSQL: AgreementContractSQL[];
  attributesSQL: AgreementAttributeSQL[];
}): Array<WithMetadata<Agreement>> =>
  agreementsSQL.map((agreementSQL) =>
    aggregateAgreement({
      agreementSQL,
      stampsSQL: stampsSQL.filter(
        (stampSQL) => stampSQL.agreementId === agreementSQL.id
      ),
      consumerDocumentsSQL: consumerDocumentsSQL.filter(
        (documentSQL) => documentSQL.agreementId === agreementSQL.id
      ),
      contractSQL: contractsSQL.find(
        (contractSQL) => contractSQL.agreementId === agreementSQL.id
      ),
      attributesSQL: attributesSQL.filter(
        (attributeSQL) => attributeSQL.agreementId === agreementSQL.id
      ),
    })
  );

export const aggregateAgreement = ({
  agreementSQL,
  stampsSQL,
  consumerDocumentsSQL,
  contractSQL,
  attributesSQL,
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
        match(a.kind)
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
          .otherwise(() => {
            throw genericInternalError(`Unknown attribute kind: ${a.kind}`);
          }),
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
      match(stamp.kind)
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
        .otherwise(() => {
          throw genericInternalError(`Unknown stamp kind: ${stamp.kind}`);
        }),
    {}
  );

  const agreement: Agreement = {
    id: unsafeBrandId<AgreementId>(agreementSQL.id),
    eserviceId: unsafeBrandId<EServiceId>(agreementSQL.eserviceId),
    descriptorId: unsafeBrandId<DescriptorId>(agreementSQL.descriptorId),
    producerId: unsafeBrandId<TenantId>(agreementSQL.producerId),
    consumerId: unsafeBrandId<TenantId>(agreementSQL.consumerId),
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
  };

  return {
    data: agreement,
    metadata: { version: agreementSQL.metadataVersion },
  };
};

const documentSQLtoDocument = (
  documentSQL: AgreementContractSQL | AgreementConsumerDocumentSQL
): AgreementDocument => ({
  id: unsafeBrandId<AgreementDocumentId>(documentSQL.id),
  path: documentSQL.path,
  name: documentSQL.name,
  prettyName: documentSQL.prettyName,
  contentType: documentSQL.contentType,
  createdAt: stringToDate(documentSQL.createdAt),
});

const stampSQLtoStamp = (stampSQL: AgreementStampSQL): AgreementStamp => ({
  who: unsafeBrandId<UserId>(stampSQL.who),
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
  }>
): AgreementItemsSQL => {
  const {
    agreementsSQL,
    stampsSQL,
    attributesSQL,
    consumerDocumentsSQL,
    contractsSQL,
  } = toAgreementAggregatorArray(queryRes);

  return {
    agreementSQL: agreementsSQL[0],
    stampsSQL,
    attributesSQL,
    consumerDocumentsSQL,
    contractSQL: contractsSQL.length > 0 ? contractsSQL[0] : undefined,
  };
};

export const toAgreementAggregatorArray = (
  queryRes: Array<{
    agreement: AgreementSQL;
    stamp: AgreementStampSQL | null;
    attribute: AgreementAttributeSQL | null;
    consumerDocument: AgreementConsumerDocumentSQL | null;
    contract: AgreementContractSQL | null;
  }>
): {
  agreementsSQL: AgreementSQL[];
  stampsSQL: AgreementStampSQL[];
  attributesSQL: AgreementAttributeSQL[];
  consumerDocumentsSQL: AgreementConsumerDocumentSQL[];
  contractsSQL: AgreementContractSQL[];
} => {
  const result = queryRes.reduce(
    (
      acc: {
        agreementIds: Set<string>;
        stampIds: Set<string>;
        attributeIds: Set<string>;
        contractIds: Set<string>;
        documentIds: Set<string>;
        agreementsSQL: AgreementSQL[];
        stampsSQL: AgreementStampSQL[];
        attributesSQL: AgreementAttributeSQL[];
        consumerDocumentsSQL: AgreementConsumerDocumentSQL[];
        contractsSQL: AgreementContractSQL[];
      },
      row
    ) => {
      const agreementSQL = row.agreement;
      const isNewAgreement = !acc.agreementIds.has(agreementSQL.id);
      const agreementsSQL = isNewAgreement
        ? [...acc.agreementsSQL, agreementSQL]
        : acc.agreementsSQL;
      const agreementIds = isNewAgreement
        ? new Set([...acc.agreementIds, agreementSQL.id])
        : acc.agreementIds;

      const stampSQL = row.stamp;
      const stampKey = stampSQL
        ? makeUniqueKey([stampSQL.agreementId, stampSQL.kind])
        : undefined;
      const isNewStamp = stampSQL && !!stampKey && !acc.stampIds.has(stampKey);
      const stampsSQL = isNewStamp
        ? [...acc.stampsSQL, stampSQL]
        : acc.stampsSQL;
      const stampIds = isNewStamp
        ? new Set([...acc.stampIds, stampKey])
        : acc.stampIds;

      const attributeSQL = row.attribute;
      const attributeKey = attributeSQL
        ? makeUniqueKey([attributeSQL.agreementId, attributeSQL.attributeId])
        : undefined;
      const isNewAttribute =
        attributeSQL && !!attributeKey && !acc.attributeIds.has(attributeKey);
      const attributesSQL = isNewAttribute
        ? [...acc.attributesSQL, attributeSQL]
        : acc.attributesSQL;
      const attributeIds = isNewAttribute
        ? new Set([...acc.attributeIds, attributeKey])
        : acc.attributeIds;

      const contractSQL = row.contract;
      const isNewContract = contractSQL && !acc.contractIds.has(contractSQL.id);
      const contractsSQL = isNewContract
        ? [...acc.contractsSQL, contractSQL]
        : acc.contractsSQL;
      const contractIds = isNewContract
        ? new Set([...acc.contractIds, contractSQL.id])
        : acc.contractIds;

      const documentSQL = row.consumerDocument;
      const isNewDocument = documentSQL && !acc.documentIds.has(documentSQL.id);
      const consumerDocumentsSQL = isNewDocument
        ? [...acc.consumerDocumentsSQL, documentSQL]
        : acc.consumerDocumentsSQL;
      const documentIds = isNewDocument
        ? new Set([...acc.documentIds, documentSQL.id])
        : acc.documentIds;

      return {
        agreementIds,
        stampIds,
        attributeIds,
        contractIds,
        documentIds,
        agreementsSQL,
        stampsSQL,
        attributesSQL,
        consumerDocumentsSQL,
        contractsSQL,
      };
    },
    {
      agreementIds: new Set<string>(),
      stampIds: new Set<string>(),
      attributeIds: new Set<string>(),
      contractIds: new Set<string>(),
      documentIds: new Set<string>(),
      agreementsSQL: [],
      stampsSQL: [],
      attributesSQL: [],
      consumerDocumentsSQL: [],
      contractsSQL: [],
    }
  );

  return {
    agreementsSQL: result.agreementsSQL,
    stampsSQL: result.stampsSQL,
    attributesSQL: result.attributesSQL,
    consumerDocumentsSQL: result.consumerDocumentsSQL,
    contractsSQL: result.contractsSQL,
  };
};
