import {
  AgreementDocumentV1,
  AgreementV1,
  StampV1,
  StampsV1,
} from "pagopa-interop-models";

export type AgreementDocumentV1Notification = Omit<
  AgreementDocumentV1,
  "createdAt"
> & {
  createdAt: string;
};

export type AgreementStampV1Notification = Omit<StampV1, "when"> & {
  when: string;
};

export type AgreementStampsV1Notification = Omit<
  StampsV1,
  | "submission"
  | "activation"
  | "rejection"
  | "suspensionByProducer"
  | "upgrade"
  | "archiving"
  | "suspensionByConsumer"
> & {
  submission?: AgreementStampV1Notification;
  activation?: AgreementStampV1Notification;
  rejection?: AgreementStampV1Notification;
  suspensionByProducer?: AgreementStampV1Notification;
  upgrade?: AgreementStampV1Notification;
  archiving?: AgreementStampV1Notification;
  suspensionByConsumer?: AgreementStampV1Notification;
};

export type AgreementV1Notification = Omit<
  AgreementV1,
  | "state"
  | "createdAt"
  | "updatedAt"
  | "consumerDocuments"
  | "contract"
  | "stamps"
  | "suspendedAt"
> & {
  state: string;
  createdAt: string;
  updatedAt?: string;
  consumerDocuments: AgreementDocumentV1Notification[];
  contract?: AgreementDocumentV1Notification;
  stamps?: AgreementStampsV1Notification;
  suspendedAt?: string;
};

// AgreementAddedV1
// AgreementActivatedV1
// AgreementSuspendedV1
// AgreementDeactivatedV1
// AgreementUpdatedV1
// VerifiedAttributeUpdatedV1
export type AgreementNotification = {
  agreement: AgreementV1Notification;
};

// AgreementDeletedV1
export type AgreementIdNotification = {
  agreementId: string;
};

// AgreementConsumerDocumentAddedV1
export type AgreementIdAndDocumentNotification = {
  agreementId: string;
  document: AgreementDocumentV1Notification;
};

// AgreementConsumerDocumentRemovedV1
export type AgreementIdAndDocumentIdNotification = {
  agreementId: string;
  documentId: string;
};

export type AgreementEventNotification =
  | AgreementNotification
  | AgreementIdNotification
  | AgreementIdAndDocumentNotification
  | AgreementIdAndDocumentIdNotification;
