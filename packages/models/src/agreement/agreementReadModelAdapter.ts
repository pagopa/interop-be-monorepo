/*
  This code adapts Agreement to AgreementReadModel,
  for retro-compatibility with the read model in production:
  the Scala services read/write ISO strings for all date fields.

  After all services will be migrated to TS, we should remove these adapters
  and the corresponding models, as tracked in https://pagopa.atlassian.net/browse/IMN-367
*/

import {
  AgreementDocumentReadModel,
  AgreementReadModel,
  AgreementStampReadModel,
  AgreementStampsReadModel,
} from "../read-models/agreementReadModel.js";
import {
  Agreement,
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
} from "./agreement.js";

export const toReadModelAgreementDocument = (
  doc: AgreementDocument
): AgreementDocumentReadModel => ({
  ...doc,
  createdAt: doc.createdAt.toISOString(),
});

export const toReadModelAgreementStamp = (
  stamp: AgreementStamp
): AgreementStampReadModel => ({
  ...stamp,
  when: stamp.when.toISOString(),
});

export const toReadModelAgreementStamps = (
  stamps: AgreementStamps
): AgreementStampsReadModel => ({
  ...stamps,
  submission: stamps.submission
    ? toReadModelAgreementStamp(stamps.submission)
    : undefined,
  activation: stamps.activation
    ? toReadModelAgreementStamp(stamps.activation)
    : undefined,
  rejection: stamps.rejection
    ? toReadModelAgreementStamp(stamps.rejection)
    : undefined,
  suspensionByProducer: stamps.suspensionByProducer
    ? toReadModelAgreementStamp(stamps.suspensionByProducer)
    : undefined,
  suspensionByConsumer: stamps.suspensionByConsumer
    ? toReadModelAgreementStamp(stamps.suspensionByConsumer)
    : undefined,
  upgrade: stamps.upgrade
    ? toReadModelAgreementStamp(stamps.upgrade)
    : undefined,
  archiving: stamps.archiving
    ? toReadModelAgreementStamp(stamps.archiving)
    : undefined,
});

export const toReadModelAgreement = (
  agreement: Agreement
): AgreementReadModel => ({
  ...agreement,
  consumerDocuments: agreement.consumerDocuments.map(
    toReadModelAgreementDocument
  ),
  createdAt: agreement.createdAt.toISOString(),
  updatedAt: agreement.updatedAt?.toISOString(),
  contract: agreement.contract
    ? toReadModelAgreementDocument(agreement.contract)
    : undefined,
  stamps: toReadModelAgreementStamps(agreement.stamps),
  suspendedAt: agreement.suspendedAt?.toISOString(),
});
