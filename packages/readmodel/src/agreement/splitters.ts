import {
  Agreement,
  AgreementContract,
  AgreementDocument,
  AgreementId,
  AgreementStamp,
  AgreementStampKind,
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
    signedContract,
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
    suspendedByConsumer: suspendedByConsumer ?? null, // "??" because "false" should not become null
    suspendedByProducer: suspendedByProducer ?? null,
    suspendedByPlatform: suspendedByPlatform ?? null,
    createdAt: dateToString(createdAt),
    updatedAt: dateToString(updatedAt),
    consumerNotes: consumerNotes ?? null, // "??" because empty strings should not become null
    rejectionReason: rejectionReason ?? null,
    suspendedAt: dateToString(suspendedAt),
    signedContract: signedContract || null,
  };

  const makeStampSQL = (
    { who, delegationId, when, ...stampRest }: AgreementStamp,
    agreementId: AgreementId,
    metadataVersion: number,
    kind: AgreementStampKind
  ): AgreementStampSQL => {
    void (stampRest satisfies Record<string, never>);

    return {
      agreementId,
      metadataVersion,
      kind,
      who,
      when: dateToString(when),
      delegationId: delegationId || null,
    };
  };

  const stampsSQL: AgreementStampSQL[] = Object.entries(stamps)
    .filter((entry): entry is [AgreementStampKind, AgreementStamp] => {
      const [, stamp] = entry;
      return stamp !== undefined;
    })
    .map(([key, stamp]) => makeStampSQL(stamp, id, metadataVersion, key));

  const contractSQL = contract
    ? agreementDocumentToAgreementDocumentSQL(contract, id, metadataVersion)
    : undefined;

  const consumerDocumentsSQL = consumerDocuments.map((doc) =>
    agreementConsumerDocumentToAgreementConsumerDocumentSQL(
      doc,
      id,
      metadataVersion
    )
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

export const agreementConsumerDocumentToAgreementConsumerDocumentSQL = (
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
): AgreementConsumerDocumentSQL => {
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
export const agreementDocumentToAgreementDocumentSQL = (
  {
    id,
    name,
    prettyName,
    contentType,
    path,
    createdAt,
    signedAt,
    ...rest
  }: AgreementContract,
  agreementId: AgreementId,
  metadataVersion: number
): AgreementContractSQL => {
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
    signedAt: dateToString(signedAt),
  };
};
