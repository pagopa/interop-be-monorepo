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
  agreementStampKind,
  AgreementStampKind,
  genericInternalError,
  AgreementAttribute,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const aggregateAgreementSQLArray = ({
  agreementSQL,
  stampsSQL,
  consumerDocumentsSQL,
  contractSQL,
  attributesSQL,
}: {
  agreementSQL: AgreementSQL[];
  stampsSQL: AgreementStampSQL[];
  consumerDocumentsSQL: AgreementConsumerDocumentSQL[];
  contractSQL: AgreementContractSQL | null;
  attributesSQL: AgreementAttributeSQL[];
}): Array<WithMetadata<Agreement>> =>
  agreementSQL.map((agreementSQL) =>
    aggregateAgreementSQL({
      agreementSQL,
      stampsSQL: stampsSQL.filter(
        (stampSQL) => stampSQL.agreementId === agreementSQL.id
      ),
      consumerDocumentsSQL: consumerDocumentsSQL.filter(
        (documentSQL) => documentSQL.agreementId === agreementSQL.id
      ),
      contractSQL,
      attributesSQL: attributesSQL.filter(
        (attributeSQL) => attributeSQL.agreementId === agreementSQL.id
      ),
    })
  );

export const aggregateAgreementSQL = ({
  agreementSQL: {
    id,
    eserviceId,
    consumerId,
    producerId,
    descriptorId,
    state,
    createdAt,
    updatedAt,
    suspendedAt,
    suspendedByConsumer,
    suspendedByProducer,
    suspendedByPlatform,
    consumerNotes,
    rejectionReason,
    metadataVersion,
    ...rest
  },
  stampsSQL,
  consumerDocumentsSQL,
  contractSQL,
  attributesSQL,
}: AgreementItemsSQL): WithMetadata<Agreement> => {
  void (rest satisfies Record<string, never>);

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
        .with(agreementStampKind.submission, () => ({
          ...acc,
          submission: stamp,
        }))
        .with(agreementStampKind.activation, () => ({
          ...acc,
          activation: stamp,
        }))
        .with(agreementStampKind.rejection, () => ({
          ...acc,
          rejection: stamp,
        }))
        .with(agreementStampKind.suspensionByProducer, () => ({
          ...acc,
          suspensionByProducer: stamp,
        }))
        .with(agreementStampKind.suspensionByConsumer, () => ({
          ...acc,
          suspensionByConsumer: stamp,
        }))
        .with(agreementStampKind.upgrade, () => ({
          ...acc,
          upgrade: stamp,
        }))
        .with(agreementStampKind.archiving, () => ({
          ...acc,
          archiving: stamp,
        }))
        .otherwise(() => {
          throw genericInternalError(`Unknown stamp kind: ${stamp.kind}`);
        }),
    {}
  );

  const agreement: Agreement = {
    id: unsafeBrandId<AgreementId>(id),
    eserviceId: unsafeBrandId<EServiceId>(eserviceId),
    descriptorId: unsafeBrandId<DescriptorId>(descriptorId),
    producerId: unsafeBrandId<TenantId>(producerId),
    consumerId: unsafeBrandId<TenantId>(consumerId),
    state: AgreementState.parse(state),
    verifiedAttributes,
    certifiedAttributes,
    declaredAttributes,
    ...(suspendedByConsumer !== null
      ? {
          suspendedByConsumer,
        }
      : {}),
    ...(suspendedByProducer !== null
      ? {
          suspendedByProducer,
        }
      : {}),
    ...(suspendedByPlatform !== null
      ? {
          suspendedByPlatform,
        }
      : {}),
    consumerDocuments,
    createdAt: stringToDate(createdAt),
    ...(updatedAt ? { updatedAt: stringToDate(updatedAt) } : {}),
    ...(consumerNotes !== null
      ? {
          consumerNotes,
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
    ...(rejectionReason !== null
      ? {
          rejectionReason,
        }
      : {}),
    ...(suspendedAt !== null
      ? {
          suspendedAt: stringToDate(suspendedAt),
        }
      : {}),
  };

  return {
    data: agreement,
    metadata: { version: metadataVersion },
  };
};

const documentSQLtoDocument = ({
  id,
  path,
  name,
  prettyName,
  contentType,
  createdAt,
  ...rest
}: Omit<
  AgreementContractSQL | AgreementConsumerDocumentSQL,
  "agreementId" | "metadataVersion"
>): AgreementDocument => {
  void (rest satisfies Record<string, never>);

  return {
    id: unsafeBrandId<AgreementDocumentId>(id),
    path,
    name,
    prettyName,
    contentType,
    createdAt: stringToDate(createdAt),
  };
};

const stampSQLtoStamp = ({
  who,
  when,
  delegationId,
  ...rest
}: Omit<
  AgreementStampSQL,
  "agreementId" | "metadataVersion" | "kind"
>): AgreementStamp => {
  void (rest satisfies Record<string, never>);

  return {
    who: unsafeBrandId<UserId>(who),
    when: stringToDate(when),
    ...(delegationId !== null
      ? {
          delegationId: unsafeBrandId<DelegationId>(delegationId),
        }
      : {}),
  };
};
