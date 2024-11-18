import {
  Agreement,
  Client,
  EService,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { z } from "zod";

// purpose
export const ComparisonPurpose = Purpose.pick({
  id: true,
  consumerId: true,
  eserviceId: true,
  versions: true,
});
export type ComparisonPurpose = z.infer<typeof ComparisonPurpose>;

export const ComparisonPlatformStatesPurposeEntry =
  PlatformStatesPurposeEntry.pick({
    PK: true,
    state: true,
    purposeConsumerId: true,
    purposeEserviceId: true,
    purposeVersionId: true,
  });
export type ComparisonPlatformStatesPurposeEntry = z.infer<
  typeof ComparisonPlatformStatesPurposeEntry
>;

export const ComparisonTokenStatesPurposeEntry =
  TokenGenerationStatesClientPurposeEntry.pick({
    PK: true,
    consumerId: true,
    GSIPK_purposeId: true,
    purposeState: true,
    purposeVersionId: true,
    GSIPK_clientId_purposeId: true,
  });
export type ComparisonTokenStatesPurposeEntry = z.infer<
  typeof ComparisonTokenStatesPurposeEntry
>;

export type PurposeDifferencesResult = Array<
  [
    ComparisonPlatformStatesPurposeEntry | undefined,
    ComparisonTokenStatesPurposeEntry[] | undefined,
    ComparisonPurpose | undefined
  ]
>;

// agreement
export const ComparisonAgreement = Agreement.pick({
  id: true,
  state: true,
  consumerId: true,
  eserviceId: true,
  descriptorId: true,
});
export type ComparisonAgreement = z.infer<typeof ComparisonAgreement>;

export const ComparisonPlatformStatesAgreementEntry =
  PlatformStatesAgreementEntry.pick({
    PK: true,
    state: true,
    GSIPK_consumerId_eserviceId: true,
    agreementDescriptorId: true,
  });
export type ComparisonPlatformStatesAgreementEntry = z.infer<
  typeof ComparisonPlatformStatesAgreementEntry
>;

export const ComparisonTokenStatesAgreementEntry =
  TokenGenerationStatesClientPurposeEntry.pick({
    PK: true,
    consumerId: true,
    agreementId: true,
    agreementState: true,
    GSIPK_consumerId_eserviceId: true,
    GSIPK_eserviceId_descriptorId: true,
  });
export type ComparisonTokenStatesAgreementEntry = z.infer<
  typeof ComparisonTokenStatesAgreementEntry
>;

export type AgreementDifferencesResult = Array<
  [
    ComparisonPlatformStatesAgreementEntry | undefined,
    ComparisonTokenStatesAgreementEntry[] | undefined,
    ComparisonAgreement | undefined
  ]
>;

// catalog
export const ComparisonEService = EService.pick({
  id: true,
  descriptors: true,
});
export type ComparisonEService = z.infer<typeof ComparisonEService>;

export const ComparisonPlatformStatesCatalogEntry =
  PlatformStatesCatalogEntry.pick({
    PK: true,
    state: true,
    descriptorAudience: true,
    descriptorVoucherLifespan: true,
  });
export type ComparisonPlatformStatesCatalogEntry = z.infer<
  typeof ComparisonPlatformStatesCatalogEntry
>;

export const ComparisonTokenStatesCatalogEntry =
  TokenGenerationStatesClientPurposeEntry.pick({
    PK: true,
    GSIPK_consumerId_eserviceId: true,
    GSIPK_eserviceId_descriptorId: true,
    descriptorState: true,
    descriptorAudience: true,
    descriptorVoucherLifespan: true,
  });
export type ComparisonTokenStatesCatalogEntry = z.infer<
  typeof ComparisonTokenStatesCatalogEntry
>;

export type CatalogDifferencesResult = Array<
  [
    ComparisonPlatformStatesCatalogEntry | undefined,
    ComparisonTokenStatesCatalogEntry[] | undefined,
    ComparisonEService | undefined
  ]
>;

// client
export const ComparisonClient = Client.pick({
  id: true,
  kind: true,
  consumerId: true,
  purposes: true,
});
export type ComparisonClient = z.infer<typeof ComparisonClient>;

export const ComparisonPlatformStatesClientEntry =
  PlatformStatesClientEntry.pick({
    PK: true,
    clientKind: true,
    clientConsumerId: true,
    clientPurposesIds: true,
  });
export type ComparisonPlatformStatesClientEntry = z.infer<
  typeof ComparisonPlatformStatesClientEntry
>;

const TokenStatesClientEntryPK = z.union([
  TokenGenerationStatesClientPurposeEntry.shape.PK,
  TokenGenerationStatesClientEntry.shape.PK,
]);
export const ComparisonTokenStatesClientEntry =
  TokenGenerationStatesClientPurposeEntry.pick({
    consumerId: true,
    clientKind: true,
    GSIPK_clientId: true,
    GSIPK_clientId_purposeId: true,
  }).extend({
    PK: TokenStatesClientEntryPK,
  });

export type ComparisonTokenStatesClientEntry = z.infer<
  typeof ComparisonTokenStatesClientEntry
>;

export type ClientDifferencesResult = Array<
  [
    ComparisonPlatformStatesClientEntry | undefined,
    ComparisonTokenStatesClientEntry[] | undefined,
    ComparisonClient | undefined
  ]
>;
