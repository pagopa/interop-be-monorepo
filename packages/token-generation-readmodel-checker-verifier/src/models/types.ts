import {
  Agreement,
  PlatformStatesAgreementEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { z } from "zod";

// purpose
export const PartialPurpose = Purpose.pick({
  id: true,
  consumerId: true,
  eserviceId: true,
  versions: true,
});
export type PartialPurpose = z.infer<typeof PartialPurpose>;

export const PartialPlatformStatesPurposeEntry =
  PlatformStatesPurposeEntry.pick({
    PK: true,
    state: true,
    purposeConsumerId: true,
    purposeEserviceId: true,
    purposeVersionId: true,
  });
export type PartialPlatformStatesPurposeEntry = z.infer<
  typeof PartialPlatformStatesPurposeEntry
>;

export const PartialTokenStatesPurposeEntry =
  TokenGenerationStatesClientPurposeEntry.pick({
    PK: true,
    consumerId: true,
    GSIPK_purposeId: true,
    purposeState: true,
    purposeVersionId: true,
    GSIPK_clientId_purposeId: true,
  });
export type PartialTokenStatesPurposeEntry = z.infer<
  typeof PartialTokenStatesPurposeEntry
>;

export type PurposeDifferencesResult = Array<
  [
    PartialPlatformStatesPurposeEntry | undefined,
    PartialTokenStatesPurposeEntry[] | undefined,
    PartialPurpose | undefined
  ]
>;

// agreement
export const PartialAgreement = Agreement.pick({
  id: true,
  state: true,
  consumerId: true,
  eserviceId: true,
  descriptorId: true,
});
export type PartialAgreement = z.infer<typeof PartialAgreement>;

export const PartialPlatformStatesAgreementEntry =
  PlatformStatesAgreementEntry.pick({
    PK: true,
    state: true,
    GSIPK_consumerId_eserviceId: true,
    agreementDescriptorId: true,
  });
export type PartialPlatformStatesAgreementEntry = z.infer<
  typeof PartialPlatformStatesAgreementEntry
>;

export const PartialTokenStatesAgreementEntry =
  TokenGenerationStatesClientPurposeEntry.pick({
    PK: true,
    consumerId: true,
    agreementId: true,
    agreementState: true,
    GSIPK_consumerId_eserviceId: true,
    GSIPK_eserviceId_descriptorId: true,
  });
export type PartialTokenStatesAgreementEntry = z.infer<
  typeof PartialTokenStatesAgreementEntry
>;

export type AgreementDifferencesResult = Array<
  [
    PartialPlatformStatesAgreementEntry | undefined,
    PartialTokenStatesAgreementEntry[] | undefined,
    PartialAgreement | undefined
  ]
>;
