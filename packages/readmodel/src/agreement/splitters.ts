import {
  Agreement,
  AgreementAttributeSQL,
  AgreementDocument,
  agreementDocumentKind,
  AgreementDocumentKind,
  AgreementDocumentSQL,
  AgreementId,
  AgreementSQL,
  AgreementStamp,
  AgreementStampKind,
  agreementStampKind,
  AgreementStamps,
  AgreementStampSQL,
  attributeKind,
} from "pagopa-interop-models";

export const splitAgreementIntoObjectsSQL = (
  {
    id,
    eserviceId,
    descriptorId,
    producerId,
    consumerId,
    state,
    verifiedAttributes,
    certifiedAttributes,
    declaredAttributes,
    suspendedByConsumer,
    suspendedByProducer,
    suspendedByPlatform,
    consumerDocuments,
    createdAt,
    updatedAt,
    consumerNotes,
    contract,
    stamps,
    rejectionReason,
    suspendedAt,
    ...rest
  }: Agreement,
  metadata_version: number
): {
  agreementSQL: AgreementSQL;
  agreementStampsSQL: AgreementStampSQL[];
  agreementDocumentsSQL: AgreementDocumentSQL[];
  agreementAttributesSQL: AgreementAttributeSQL[];
} => {
  void (rest satisfies Record<string, never>);
  const agreementSQL: AgreementSQL = {
    id,
    metadata_version,
    eservice_id: eserviceId,
    descriptor_id: descriptorId,
    producer_id: producerId,
    consumer_id: consumerId,
    state: state,
    suspended_by_consumer: suspendedByConsumer,
    suspended_by_producer: suspendedByProducer,
    suspended_by_platform: suspendedByPlatform,
    created_at: createdAt,
    updated_at: updatedAt,
    consumer_notes: consumerNotes,
    rejection_reason: rejectionReason,
    suspended_at: suspendedAt,
  };

  const agreementStampsSQL: AgreementStampSQL[] = [];

  const makeStampSQL = (
    agreementStamp: AgreementStamp,
    agreementId: AgreementId,
    metadata_version: number,
    kind: AgreementStampKind
  ): AgreementStampSQL => ({
    agreement_id: agreementId,
    metadata_version,
    kind: kind,
    who: agreementStamp.who,
    when: agreementStamp.when,
    delegation_id: agreementStamp.delegationId,
  });

  let key: keyof AgreementStamps;

  for (key in stamps) {
    const stamp = stamps[key];
    if (stamp) {
      agreementStampsSQL.push(
        makeStampSQL(stamp, id, metadata_version, agreementStampKind[key])
      );
    }
  }

  /*
  if (stamps.submission) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.submission,
        id,
        metadata_version,
        agreementStampKind.submission
      )
    );
  }
  if (stamps.activation) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.activation,
        id,
        metadata_version,
        agreementStampKind.activation
      )
    );
  }
  if (stamps.rejection) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.rejection,
        id,
        metadata_version,
        agreementStampKind.rejection
      )
    );
  }
  if (stamps.suspensionByProducer) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.suspensionByProducer,
        id,
        metadata_version,
        agreementStampKind.suspensionByProducer
      )
    );
  }
  if (stamps.suspensionByConsumer) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.suspensionByConsumer,
        id,
        metadata_version,
        agreementStampKind.suspensionByConsumer
      )
    );
  }
  if (stamps.upgrade) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.upgrade,
        id,
        metadata_version,
        agreementStampKind.upgrade
      )
    );
  }
  if (stamps.archiving) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.archiving,
        id,
        metadata_version,
        agreementStampKind.archiving
      )
    );
  }
*/

  const agreementContractSQL = contract
    ? agreementDocumentToAgreementDocumentSQL(
        contract,
        agreementDocumentKind.contract,
        id,
        metadata_version
      )
    : undefined;

  const consumerDocumentsSQL = consumerDocuments.map((doc) =>
    agreementDocumentToAgreementDocumentSQL(
      doc,
      agreementDocumentKind.consumerDoc,
      id,
      metadata_version
    )
  );

  const agreementAttributesSQL: AgreementAttributeSQL[] = [
    ...certifiedAttributes.map((attr) => ({
      agreement_id: id,
      metadata_version,
      attribute_id: attr.id,
      kind: attributeKind.certified,
    })),
    ...declaredAttributes.map((attr) => ({
      agreement_id: id,
      metadata_version,
      attribute_id: attr.id,
      kind: attributeKind.declared,
    })),
    ...verifiedAttributes.map((attr) => ({
      agreement_id: id,
      metadata_version,
      attribute_id: attr.id,
      kind: attributeKind.verified,
    })),
  ];

  const documentsSQL = agreementContractSQL
    ? [agreementContractSQL, ...consumerDocumentsSQL]
    : [...consumerDocumentsSQL];
  return {
    agreementSQL,
    agreementStampsSQL,
    agreementDocumentsSQL: documentsSQL,
    agreementAttributesSQL,
  };
};

export const agreementDocumentToAgreementDocumentSQL = (
  {
    id,
    name,
    prettyName,
    contentType,
    path,
    createdAt,
    ...rest
  }: AgreementDocument,
  kind: AgreementDocumentKind,
  agreementId: AgreementId,
  metadata_version: number
): AgreementDocumentSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id: id,
    agreement_id: agreementId,
    metadata_version,
    name: name,
    pretty_name: prettyName,
    content_type: contentType,
    path: path,
    created_at: createdAt,
    kind,
  };
};
