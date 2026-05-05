import {
  clientKindTokenGenStates,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesPurposeEntry,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
import { z } from "zod";

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

export const ComparisonPlatformStatesAgreementEntry =
  PlatformStatesAgreementEntry.pick({
    PK: true,
    state: true,
    agreementId: true,
    agreementDescriptorId: true,
    agreementTimestamp: true,
    producerId: true,
  });
export type ComparisonPlatformStatesAgreementEntry = z.infer<
  typeof ComparisonPlatformStatesAgreementEntry
>;

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

export const ComparisonTokenGenStatesGenericClient =
  TokenGenerationStatesConsumerClient.pick({
    consumerId: true,
    GSIPK_clientId: true,
    GSIPK_clientId_kid: true,
    publicKey: true,
    GSIPK_clientId_purposeId: true,
    GSIPK_purposeId: true,
    purposeState: true,
    purposeVersionId: true,
    agreementId: true,
    agreementState: true,
    GSIPK_consumerId_eserviceId: true,
    GSIPK_eserviceId_descriptorId: true,
    descriptorState: true,
    descriptorAudience: true,
    descriptorVoucherLifespan: true,
  })
    .extend({
      PK:
        TokenGenerationStatesConsumerClient.shape.PK ||
        TokenGenerationStatesApiClient.shape.PK,
      clientKind: z.union([
        z.literal(clientKindTokenGenStates.consumer),
        z.literal(clientKindTokenGenStates.api),
      ]),
    })
    .partial();

export type ComparisonTokenGenStatesGenericClient = z.infer<
  typeof ComparisonTokenGenStatesGenericClient
>;
