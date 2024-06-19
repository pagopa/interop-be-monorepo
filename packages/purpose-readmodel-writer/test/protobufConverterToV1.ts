import { match } from "ts-pattern";
import {
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionState,
  purposeVersionState,
  dateToBigInt,
  PurposeStateV1,
  PurposeV1,
  PurposeVersionDocumentV1,
  PurposeVersionV1,
} from "pagopa-interop-models";

export const toPurposeVersionStateV1 = (
  input: PurposeVersionState
): PurposeStateV1 =>
  match(input)
    .with(purposeVersionState.draft, () => PurposeStateV1.DRAFT)
    .with(purposeVersionState.active, () => PurposeStateV1.ACTIVE)
    .with(purposeVersionState.suspended, () => PurposeStateV1.SUSPENDED)
    .with(purposeVersionState.archived, () => PurposeStateV1.ARCHIVED)
    .with(
      purposeVersionState.waitingForApproval,
      () => PurposeStateV1.WAITING_FOR_APPROVAL
    )
    .with(purposeVersionState.rejected, () => PurposeStateV1.REJECTED)
    .exhaustive();

export const toPurposeVersionDocumentV1 = (
  input: PurposeVersionDocument
): PurposeVersionDocumentV1 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
});

export const toPurposeVersionV1 = (
  input: PurposeVersion
): PurposeVersionV1 => ({
  ...input,
  state: toPurposeVersionStateV1(input.state),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigInt(input.updatedAt),
  firstActivationAt: dateToBigInt(input.firstActivationAt),
  suspendedAt: dateToBigInt(input.suspendedAt),
  riskAnalysis: input.riskAnalysis
    ? toPurposeVersionDocumentV1(input.riskAnalysis)
    : undefined,
});

export const toPurposeV1 = (input: Purpose): PurposeV1 => ({
  ...input,
  versions: input.versions.map(toPurposeVersionV1),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigInt(input.updatedAt),
});
