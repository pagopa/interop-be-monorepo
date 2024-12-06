import {
  Agreement,
  Client,
  clientKindTokenGenStates,
  EService,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
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

export const ComparisonTokenGenStatesConsumerClientPurpose =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    consumerId: true,
    GSIPK_purposeId: true,
    purposeState: true,
    purposeVersionId: true,
    GSIPK_clientId_purposeId: true,
  });
export type ComparisonTokenGenStatesConsumerClientPurpose = z.infer<
  typeof ComparisonTokenGenStatesConsumerClientPurpose
>;

export type PurposeDifferencesResult = Array<
  [
    ComparisonPlatformStatesPurposeEntry | undefined,
    ComparisonTokenGenStatesConsumerClientPurpose[] | undefined,
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

export const ComparisonTokenGenStatesConsumerClientAgreement =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    consumerId: true,
    agreementId: true,
    agreementState: true,
    GSIPK_consumerId_eserviceId: true,
    GSIPK_eserviceId_descriptorId: true,
  });
export type ComparisonTokenGenStatesConsumerClientAgreement = z.infer<
  typeof ComparisonTokenGenStatesConsumerClientAgreement
>;

export type AgreementDifferencesResult = Array<
  [
    ComparisonPlatformStatesAgreementEntry | undefined,
    ComparisonTokenGenStatesConsumerClientAgreement[] | undefined,
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

export const ComparisonTokenGenStatesConsumerClientCatalog =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_consumerId_eserviceId: true,
    GSIPK_eserviceId_descriptorId: true,
    descriptorState: true,
    descriptorAudience: true,
    descriptorVoucherLifespan: true,
  });
export type ComparisonTokenGenStatesConsumerClientCatalog = z.infer<
  typeof ComparisonTokenGenStatesConsumerClientCatalog
>;

export type CatalogDifferencesResult = Array<
  [
    ComparisonPlatformStatesCatalogEntry | undefined,
    ComparisonTokenGenStatesConsumerClientCatalog[] | undefined,
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

export const ComparisonTokenGenStatesGenericClient =
  TokenGenerationStatesConsumerClient.pick({
    consumerId: true,
    GSIPK_clientId: true,
    GSIPK_clientId_purposeId: true,
  }).extend({
    PK:
      TokenGenerationStatesConsumerClient.shape.PK ||
      TokenGenerationStatesApiClient.shape.PK,
    clientKind: z.union([
      z.literal(clientKindTokenGenStates.consumer),
      z.literal(clientKindTokenGenStates.api),
    ]),
  });

export type ComparisonTokenGenStatesGenericClient = z.infer<
  typeof ComparisonTokenGenStatesGenericClient
>;

export type ClientDifferencesResult = Array<
  [
    ComparisonPlatformStatesClientEntry | undefined,
    ComparisonTokenGenStatesGenericClient[] | undefined,
    ComparisonClient | undefined
  ]
>;
