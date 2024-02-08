import {
  AgreementAttribute,
  AgreementStamps,
  AgreementState,
  agreementState,
} from "pagopa-interop-models";
import { z } from "zod";

export const CertifiedAgreementAttribute =
  AgreementAttribute.brand<"CertifiedAgreementAttribute">();
export type CertifiedAgreementAttribute = z.infer<
  typeof CertifiedAgreementAttribute
>;

export const DeclaredAgreementAttribute =
  AgreementAttribute.brand<"DeclaredAgreementAttribute">();
export type DeclaredAgreementAttribute = z.infer<
  typeof DeclaredAgreementAttribute
>;

export const VerifiedAgreementAttribute =
  AgreementAttribute.brand<"VerifiedAgreementAttribute">();
export type VerifiedAgreementAttribute = z.infer<
  typeof VerifiedAgreementAttribute
>;

export type UpdateAgreementSeed = {
  state: AgreementState;
  certifiedAttributes?: CertifiedAgreementAttribute[];
  declaredAttributes?: DeclaredAgreementAttribute[];
  verifiedAttributes?: VerifiedAgreementAttribute[];
  suspendedByConsumer?: boolean;
  suspendedByProducer?: boolean;
  suspendedByPlatform?: boolean;
  stamps: AgreementStamps;
  consumerNotes?: string;
  rejectionReason?: string;
  suspendedAt?: Date;
};

export const CompactOrganization = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type CompactOrganization = z.infer<typeof CompactOrganization>;

export const CompactEService = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type CompactEService = z.infer<typeof CompactEService>;

export const agreementActivableStates: AgreementState[] = [
  agreementState.pending,
  agreementState.suspended,
];
export const agreementSuspendableStates: AgreementState[] = [
  agreementState.active,
  agreementState.suspended,
];
export const agreementArchivableStates: AgreementState[] = [
  agreementState.active,
  agreementState.suspended,
];
export const agreementSubmittableStates: AgreementState[] = [
  agreementState.draft,
];

export const agreementUpdatableStates: AgreementState[] = [
  agreementState.draft,
];

export const agreementUpgradableStates: AgreementState[] = [
  agreementState.active,
  agreementState.suspended,
];
export const agreementRejectableStates: AgreementState[] = [
  agreementState.pending,
];

export const agreementDeletableStates: AgreementState[] = [
  agreementState.draft,
  agreementState.missingCertifiedAttributes,
];

export const agreementActivationFailureStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
];

export const agreementCloningConflictingStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
  agreementState.active,
  agreementState.suspended,
];

export const agreementCreationConflictingStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
  agreementState.active,
  agreementState.suspended,
];

export const agreementSubmissionConflictingStates: AgreementState[] = [
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
];
