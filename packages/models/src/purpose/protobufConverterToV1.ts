import { match } from "ts-pattern";
import {
  PurposeStateV1,
  PurposeV1,
  PurposeVersionDocumentV1,
  PurposeVersionV1,
} from "../gen/v1/purpose/purpose.js";

import {
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionState,
  purposeVersionState,
} from "./purpose.js";

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
  createdAt: BigInt(input.createdAt.getTime()),
});

export const toPurposeVersionV1 = (
  input: PurposeVersion
): PurposeVersionV1 => ({
  ...input,
  state: toPurposeVersionStateV1(input.state),
  expectedApprovalDate: input.expectedApprovalDate
    ? BigInt(input.expectedApprovalDate.getTime())
    : undefined,
  createdAt: BigInt(input.createdAt.getTime()),
  updatedAt: input.updatedAt ? BigInt(input.updatedAt.getTime()) : undefined,
  firstActivationAt: input.firstActivationAt
    ? BigInt(input.firstActivationAt.getTime())
    : undefined,
  suspendedAt: input.suspendedAt
    ? BigInt(input.suspendedAt.getTime())
    : undefined,
  riskAnalysis: input.riskAnalysis
    ? toPurposeVersionDocumentV1(input.riskAnalysis)
    : undefined,
});

export const toPurposeV1 = (input: Purpose): PurposeV1 => ({
  ...input,
  versions: input.versions.map(toPurposeVersionV1),
  createdAt: BigInt(input.createdAt.getTime()),
  updatedAt: BigInt(input.updatedAt.getTime()),
});
