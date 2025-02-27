import {
  Agreement,
  AgreementDocument,
  AgreementId,
  AgreementStamp,
  AgreementStampKind,
  agreementStampKind,
  AgreementStamps,
  attributeKind,
  dateToString,
} from "pagopa-interop-models";
import {
  AgreementSQL,
  AgreementStampSQL,
  AgreementAttributeSQL,
  AgreementConsumerDocumentSQL,
  AgreementContractSQL,
  AgreementItemsSQL,
} from "pagopa-interop-readmodel-models";

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
  metadataVersion: number
): AgreementItemsSQL => {
  void (rest satisfies Record<string, never>);
  const agreementSQL: AgreementSQL = {
    id,
    metadataVersion,
    eserviceId,
    descriptorId,
    producerId,
    consumerId,
    state,
    suspendedByConsumer: suspendedByConsumer || null,
    suspendedByProducer: suspendedByProducer || null,
    suspendedByPlatform: suspendedByPlatform || null,
    createdAt: dateToString(createdAt),
    updatedAt: dateToString(updatedAt),
    consumerNotes: consumerNotes || null,
    rejectionReason: rejectionReason || null,
    suspendedAt: dateToString(suspendedAt),
  };

  const stampsSQL: AgreementStampSQL[] = [];

  const makeStampSQL = (
    agreementStamp: AgreementStamp,
    agreementId: AgreementId,
    metadataVersion: number,
    kind: AgreementStampKind
  ): AgreementStampSQL => ({
    agreementId,
    metadataVersion,
    kind,
    who: agreementStamp.who,
    when: dateToString(agreementStamp.when),
    delegationId: agreementStamp.delegationId || null,
  });

  // TODO: improve?
  // eslint-disable-next-line functional/no-let
  let key: keyof AgreementStamps;

  // eslint-disable-next-line guard-for-in
  for (key in stamps) {
    const stamp = stamps[key];
    if (stamp) {
      // eslint-disable-next-line functional/immutable-data
      stampsSQL.push(
        makeStampSQL(stamp, id, metadataVersion, agreementStampKind[key])
      );
    }
  }

  /*
  if (stamps.submission) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.submission,
        id,
        metadataVersion,
        agreementStampKind.submission
      )
    );
  }
  if (stamps.activation) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.activation,
        id,
        metadataVersion,
        agreementStampKind.activation
      )
    );
  }
  if (stamps.rejection) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.rejection,
        id,
        metadataVersion,
        agreementStampKind.rejection
      )
    );
  }
  if (stamps.suspensionByProducer) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.suspensionByProducer,
        id,
        metadataVersion,
        agreementStampKind.suspensionByProducer
      )
    );
  }
  if (stamps.suspensionByConsumer) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.suspensionByConsumer,
        id,
        metadataVersion,
        agreementStampKind.suspensionByConsumer
      )
    );
  }
  if (stamps.upgrade) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.upgrade,
        id,
        metadataVersion,
        agreementStampKind.upgrade
      )
    );
  }
  if (stamps.archiving) {
    agreementStampsSQL.push(
      makeStampSQL(
        stamps.archiving,
        id,
        metadataVersion,
        agreementStampKind.archiving
      )
    );
  }
*/

  const contractSQL = contract
    ? agreementDocumentToAgreementDocumentSQL(contract, id, metadataVersion)
    : null;

  const consumerDocumentsSQL = consumerDocuments.map((doc) =>
    agreementDocumentToAgreementDocumentSQL(doc, id, metadataVersion)
  );

  const attributesSQL: AgreementAttributeSQL[] = [
    ...certifiedAttributes.map((attr) => ({
      agreementId: id,
      metadataVersion,
      attributeId: attr.id,
      kind: attributeKind.certified,
    })),
    ...declaredAttributes.map((attr) => ({
      agreementId: id,
      metadataVersion,
      attributeId: attr.id,
      kind: attributeKind.declared,
    })),
    ...verifiedAttributes.map((attr) => ({
      agreementId: id,
      metadataVersion,
      attributeId: attr.id,
      kind: attributeKind.verified,
    })),
  ];

  return {
    agreementSQL,
    stampsSQL,
    consumerDocumentsSQL,
    contractSQL,
    attributesSQL,
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
  agreementId: AgreementId,
  metadataVersion: number
): AgreementConsumerDocumentSQL | AgreementContractSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    agreementId,
    metadataVersion,
    name,
    prettyName,
    contentType,
    path,
    createdAt: dateToString(createdAt),
  };
};
