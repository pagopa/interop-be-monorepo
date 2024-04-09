import { match } from "ts-pattern";
import {
  PurposeStateV1,
  PurposeV1,
  PurposeVersionDocumentV1,
  PurposeVersionV1,
} from "../gen/v1/purpose/purpose.js";

import { dateToBigInt, dateToBigIntOrUndefined } from "../utils.js";
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
  createdAt: dateToBigInt(input.createdAt),
});

export const toPurposeVersionV1 = (
  input: PurposeVersion
): PurposeVersionV1 => ({
  ...input,
  state: toPurposeVersionStateV1(input.state),
  expectedApprovalDate: dateToBigIntOrUndefined(input.expectedApprovalDate),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigIntOrUndefined(input.updatedAt),
  firstActivationAt: dateToBigIntOrUndefined(input.firstActivationAt),
  suspendedAt: dateToBigIntOrUndefined(input.suspendedAt),
  riskAnalysis: input.riskAnalysis
    ? toPurposeVersionDocumentV1(input.riskAnalysis)
    : undefined,
});

export const toPurposeV1 = (input: Purpose): PurposeV1 => ({
  ...input,
  versions: input.versions.map(toPurposeVersionV1),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigIntOrUndefined(input.updatedAt),
});
