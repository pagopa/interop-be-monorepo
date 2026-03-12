import { match } from "ts-pattern";
import {
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionState,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  PurposeV1Notification,
  PurposeVersionDocumentV1Notification,
  PurposeVersionV1Notification,
} from "./purposeEventNotification.js";

const toPurposeVersionStateV1Notification = (
  input: PurposeVersionState
): string =>
  match(input)
    .with(purposeVersionState.draft, () => "Draft")
    .with(purposeVersionState.active, () => "Active")
    .with(purposeVersionState.suspended, () => "Suspended")
    .with(purposeVersionState.archived, () => "Archived")
    .with(purposeVersionState.waitingForApproval, () => "WaitingForApproval")
    .with(purposeVersionState.rejected, () => "Rejected")
    .exhaustive();

const toPurposeVersionDocumentV1Notification = (
  input: PurposeVersionDocument
): PurposeVersionDocumentV1Notification => ({
  ...input,
  createdAt: input.createdAt.toISOString(),
});

const toPurposeVersionV1Notification = (
  input: PurposeVersion
): PurposeVersionV1Notification => ({
  ...input,
  state: toPurposeVersionStateV1Notification(input.state),
  createdAt: input.createdAt.toISOString(),
  updatedAt: input.updatedAt?.toISOString(),
  firstActivationAt: input.firstActivationAt?.toISOString(),
  suspendedAt: input.suspendedAt?.toISOString(),
  riskAnalysis: input.riskAnalysis
    ? toPurposeVersionDocumentV1Notification(input.riskAnalysis)
    : undefined,
});

export const toPurposeV1Notification = (
  input: Purpose
): PurposeV1Notification => ({
  ...input,
  versions: input.versions.map(toPurposeVersionV1Notification),
  createdAt: input.createdAt.toISOString(),
  updatedAt: input.updatedAt?.toISOString(),
});
