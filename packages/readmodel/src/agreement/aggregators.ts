import {
  AgreementSQL,
  AgreementStampSQL,
  AgreementDocumentSQL,
  AgreementAttributeSQL,
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
  AgreementAttribute,
  agreementDocumentKind,
  AgreementDocument,
  AgreementDocumentId,
  AgreementStamp,
  UserId,
  DelegationId,
  agreementStampKind,
} from "pagopa-interop-models";

export const agreementSQLToAgreement = ({
  agreementSQL,
  agreementStampsSQL,
  agreementDocumentsSQL,
  agreementAttributesSQL,
}: {
  agreementSQL: AgreementSQL;
  agreementStampsSQL: AgreementStampSQL[];
  agreementDocumentsSQL: AgreementDocumentSQL[];
  agreementAttributesSQL: AgreementAttributeSQL[];
}): WithMetadata<Agreement> => {
  const verifiedAttributes: AgreementAttribute[] = agreementAttributesSQL
    .filter((a) => a.kind === attributeKind.verified)
    .map((a) => ({ id: unsafeBrandId<AttributeId>(a.attributeId) }));
  const certifiedAttributes: AgreementAttribute[] = agreementAttributesSQL
    .filter((a) => a.kind === attributeKind.certified)
    .map((a) => ({ id: unsafeBrandId<AttributeId>(a.attributeId) }));
  const declaredAttributes: AgreementAttribute[] = agreementAttributesSQL
    .filter((a) => a.kind === attributeKind.declared)
    .map((a) => ({ id: unsafeBrandId<AttributeId>(a.attributeId) }));

  const consumerDocuments: AgreementDocument[] = agreementDocumentsSQL
    .filter((d) => d.kind === agreementDocumentKind.consumerDoc)
    .map(documentSQLtoDocument);

  const contractSQL: AgreementDocumentSQL | undefined =
    agreementDocumentsSQL.find(
      (d) => d.kind === agreementDocumentKind.contract
    );
  const contract = contractSQL ? documentSQLtoDocument(contractSQL) : undefined;

  const submissionStampSQL = agreementStampsSQL.find(
    (stamp) => stamp.kind === agreementStampKind.submission
  );
  const activationStampSQL = agreementStampsSQL.find(
    (stamp) => stamp.kind === agreementStampKind.activation
  );
  const rejectionStampSQL = agreementStampsSQL.find(
    (stamp) => stamp.kind === agreementStampKind.rejection
  );
  const suspensionByProducerStampSQL = agreementStampsSQL.find(
    (stamp) => stamp.kind === agreementStampKind.suspensionByProducer
  );
  const suspensionByConsumerStampSQL = agreementStampsSQL.find(
    (stamp) => stamp.kind === agreementStampKind.suspensionByConsumer
  );
  const upgradeStampSQL = agreementStampsSQL.find(
    (stamp) => stamp.kind === agreementStampKind.upgrade
  );
  const archivingStampSQL = agreementStampsSQL.find(
    (stamp) => stamp.kind === agreementStampKind.archiving
  );
  const agreement: Agreement = {
    id: unsafeBrandId<AgreementId>(agreementSQL.id),
    eserviceId: unsafeBrandId<EServiceId>(agreementSQL.producerId),
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
    ...(contract ? { contract } : {}),
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
  document: AgreementDocumentSQL
): AgreementDocument => ({
  id: unsafeBrandId<AgreementDocumentId>(document.id),
  path: document.path,
  name: document.name,
  prettyName: document.prettyName,
  contentType: document.contentType,
  createdAt: stringToDate(document.createdAt),
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
