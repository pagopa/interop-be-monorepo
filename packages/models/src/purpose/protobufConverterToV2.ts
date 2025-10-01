import { match } from "ts-pattern";
import {
  PurposeStateV2,
  PurposeV2,
  PurposeVersionDocumentV2,
  PurposeVersionStampsV2,
  PurposeVersionStampV2,
  PurposeVersionV2,
} from "../gen/v2/purpose/purpose.js";
import { dateToBigInt } from "../utils.js";
import {
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionStamp,
  PurposeVersionStamps,
  PurposeVersionState,
  purposeVersionState,
} from "./purpose.js";

export const toPurposeVersionStateV2 = (
  input: PurposeVersionState
): PurposeStateV2 =>
  match(input)
    .with(purposeVersionState.draft, () => PurposeStateV2.DRAFT)
    .with(purposeVersionState.active, () => PurposeStateV2.ACTIVE)
    .with(purposeVersionState.suspended, () => PurposeStateV2.SUSPENDED)
    .with(purposeVersionState.archived, () => PurposeStateV2.ARCHIVED)
    .with(
      purposeVersionState.waitingForApproval,
      () => PurposeStateV2.WAITING_FOR_APPROVAL
    )
    .with(purposeVersionState.rejected, () => PurposeStateV2.REJECTED)
    .exhaustive();

export const toPurposeVersionDocumentV2 = (
  input: PurposeVersionDocument
): PurposeVersionDocumentV2 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
});

export const toPurposeVersionStampV2 = (
  input: PurposeVersionStamp
): PurposeVersionStampV2 => ({
  ...input,
  when: dateToBigInt(input.when),
});

export const toPurposeVersionStampsV2 = (
  input: PurposeVersionStamps
): PurposeVersionStampsV2 => ({
  creation: toPurposeVersionStampV2(input.creation),
});

export const toPurposeVersionV2 = (
  input: PurposeVersion
): PurposeVersionV2 => ({
  ...input,
  state: toPurposeVersionStateV2(input.state),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigInt(input.updatedAt),
  firstActivationAt: dateToBigInt(input.firstActivationAt),
  suspendedAt: dateToBigInt(input.suspendedAt),
  riskAnalysis: input.riskAnalysis
    ? toPurposeVersionDocumentV2(input.riskAnalysis)
    : undefined,
  stamps: input.stamps ? toPurposeVersionStampsV2(input.stamps) : undefined,
});

export const toPurposeV2 = (input: Purpose): PurposeV2 => ({
  ...input,
  versions: input.versions.map(toPurposeVersionV2),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigInt(input.updatedAt),
});
