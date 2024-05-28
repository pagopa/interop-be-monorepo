import {
  PurposeV1,
  PurposeVersionDocument,
  PurposeVersionV1,
} from "pagopa-interop-models";

export type PurposeVersionDocumentV1Notification = Omit<
  PurposeVersionDocument,
  "createdAt"
> & {
  createdAt: string;
};
export type PurposeVersionV1Notification = Omit<
  PurposeVersionV1,
  | "state"
  | "riskAnalysis"
  | "createdAt"
  | "updatedAt"
  | "firstActivationAt"
  | "suspendedAt"
> & {
  state: string;
  riskAnalysis?: PurposeVersionDocumentV1Notification;
  createdAt: string;
  updatedAt?: string;
  firstActivationAt?: string;
  suspendedAt?: string;
};

export type PurposeV1Notification = Omit<
  PurposeV1,
  "versions" | "createdAt" | "updatedAt"
> & {
  versions: PurposeVersionV1Notification[];
  createdAt: string;
  updatedAt?: string;
};

// PurposeCreatedV1
// PurposeUpdatedV1
// PurposeVersionCreatedV1
// PurposeVersionActivatedV1
// PurposeVersionSuspendedV1
// PurposeVersionArchivedV1
// PurposeVersionWaitedForApprovalV1
export type PurposeNotification = {
  purpose: PurposeV1Notification;
};

// PurposeVersionRejectedV1
export type PurposeAndVersionIdNotification = {
  purpose: PurposeV1Notification;
  versionId: string;
};

// PurposeDeletedV1
export type PurposeIdNotification = {
  purposeId: string;
};

// PurposeVersionDeletedV1
export type PurposeIdAndVersionIdNotification = {
  purposeId: string;
  versionId: string;
};

export type PurposeEventNotification =
  | PurposeNotification
  | PurposeAndVersionIdNotification
  | PurposeIdNotification
  | PurposeIdAndVersionIdNotification;
