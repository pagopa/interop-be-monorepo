import { z } from "zod";
import {
  AgreementId,
  ClientId,
  GSIPKClientIdPurposeId,
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  GSIPKKid,
  PurposeId,
  PurposeVersionId,
  TenantId,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
} from "../brandedIds.js";
import { ItemState } from "./platform-states-entry.js";
import { clientKindTokenGenStates } from "./commons.js";

const TokenGenerationStatesBaseEntry = z.object({
  consumerId: TenantId,
  publicKey: z.string(),
  GSIPK_clientId: ClientId,
  GSIPK_kid: GSIPKKid,
  updatedAt: z.string().datetime(),
});
type TokenGenerationStatesBaseEntry = z.infer<
  typeof TokenGenerationStatesBaseEntry
>;

export const TokenGenerationStatesConsumerClient =
  TokenGenerationStatesBaseEntry.extend({
    PK: TokenGenerationStatesClientKidPurposePK.or(
      TokenGenerationStatesClientKidPK
    ),
    clientKind: z.literal(clientKindTokenGenStates.consumer),
    GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId.optional(),
    agreementId: AgreementId.optional(),
    agreementState: ItemState.optional(),
    GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId.optional(),
    descriptorState: ItemState.optional(),
    descriptorAudience: z.array(z.string()).optional(),
    descriptorVoucherLifespan: z.number().optional(),
    GSIPK_purposeId: PurposeId.optional(),
    purposeState: ItemState.optional(),
    purposeVersionId: PurposeVersionId.optional(),
    GSIPK_clientId_purposeId: GSIPKClientIdPurposeId.optional(),
  });
export type TokenGenerationStatesConsumerClient = z.infer<
  typeof TokenGenerationStatesConsumerClient
>;

export const FullTokenGenerationStatesConsumerClient =
  TokenGenerationStatesConsumerClient.required().extend({
    PK: TokenGenerationStatesClientKidPurposePK,
  });
export type FullTokenGenerationStatesConsumerClient = z.infer<
  typeof FullTokenGenerationStatesConsumerClient
>;

export const TokenGenerationStatesApiClient =
  TokenGenerationStatesBaseEntry.extend({
    PK: TokenGenerationStatesClientKidPK,
    clientKind: z.literal(clientKindTokenGenStates.api),
  });
export type TokenGenerationStatesApiClient = z.infer<
  typeof TokenGenerationStatesApiClient
>;

export const TokenGenerationStatesGenericClient =
  TokenGenerationStatesConsumerClient.or(TokenGenerationStatesApiClient);
export type TokenGenerationStatesGenericClient = z.infer<
  typeof TokenGenerationStatesGenericClient
>;

// GSI projection types
// Agreement
export const TokenGenStatesConsumerClientWithGSIPKConsumerIdEServiceIdProjection =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_consumerId_eserviceId: true,
    agreementState: true,
    descriptorState: true,
    descriptorAudience: true,
    descriptorVoucherLifespan: true,
  });
export type TokenGenStatesConsumerClientWithGSIPKConsumerIdEServiceIdProjection =
  z.infer<
    typeof TokenGenStatesConsumerClientWithGSIPKConsumerIdEServiceIdProjection
  >;

// Client
export const TokenGenStatesApiClientWithGSIPKClientIdProjection =
  TokenGenerationStatesApiClient.pick({
    PK: true,
    GSIPK_clientId: true,
    consumerId: true,
    clientKind: true,
    publicKey: true,
    GSIPK_kid: true,
  });
export type TokenGenStatesApiClientWithGSIPKClientIdProjection = z.infer<
  typeof TokenGenStatesApiClientWithGSIPKClientIdProjection
>;

export const TokenGenStatesConsumerClientWithGSIPKClientIdProjection =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_clientId: true,
    consumerId: true,
    clientKind: true,
    publicKey: true,
    GSIPK_kid: true,
  });
export type TokenGenStatesConsumerClientWithGSIPKClientIdProjection = z.infer<
  typeof TokenGenStatesConsumerClientWithGSIPKClientIdProjection
>;

export const TokenGenStatesGenericClientWithGSIPKClientIdProjection =
  TokenGenStatesApiClientWithGSIPKClientIdProjection.or(
    TokenGenStatesConsumerClientWithGSIPKClientIdProjection
  );
export type TokenGenStatesGenericClientWithGSIPKClientIdProjection = z.infer<
  typeof TokenGenStatesGenericClientWithGSIPKClientIdProjection
>;

// ClientPurpose
export const TokenGenStatesConsumerClientWithGSIPKClientIdPurposeIdProjection =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_clientId_purposeId: true,
    GSIPK_clientId: true,
    GSIPK_kid: true,
    GSIPK_purposeId: true,
    consumerId: true,
    clientKind: true,
    publicKey: true,
  });
export type TokenGenStatesConsumerClientWithGSIPKClientIdPurposeIdProjection =
  z.infer<
    typeof TokenGenStatesConsumerClientWithGSIPKClientIdPurposeIdProjection
  >;

// Descriptor
export const TokenGenStatesConsumerClientWithGSIPKEServiceIdDescriptorIdProjection =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_eserviceId_descriptorId: true,
  });
export type TokenGenStatesConsumerClientWithGSIPKEServiceIdDescriptorIdProjection =
  z.infer<
    typeof TokenGenStatesConsumerClientWithGSIPKEServiceIdDescriptorIdProjection
  >;

// Kid
export const TokenGenStatesApiClientWithGSIPKKidProjection =
  TokenGenerationStatesApiClient.pick({
    PK: true,
    GSIPK_kid: true,
  });
export type TokenGenStatesApiClientWithGSIPKKidProjection = z.infer<
  typeof TokenGenStatesApiClientWithGSIPKKidProjection
>;

export const TokenGenStatesConsumerClientWithGSIPKKidProjection =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_kid: true,
  });
export type TokenGenStatesConsumerClientWithGSIPKKidProjection = z.infer<
  typeof TokenGenStatesConsumerClientWithGSIPKKidProjection
>;

export const TokenGenStatesGenericClientWithGSIPKKidProjection =
  TokenGenStatesApiClientWithGSIPKKidProjection.or(
    TokenGenStatesConsumerClientWithGSIPKKidProjection
  );
export type TokenGenStatesGenericClientWithGSIPKKidProjection = z.infer<
  typeof TokenGenStatesGenericClientWithGSIPKKidProjection
>;

// Purpose
export const TokenGenStatesConsumerClientWithGSIPKPurposeIdProjection =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_purposeId: true,
    agreementId: true,
    agreementState: true,
    GSIPK_eserviceId_descriptorId: true,
    descriptorAudience: true,
    descriptorState: true,
    descriptorVoucherLifespan: true,
    purposeState: true,
    purposeVersionId: true,
  });
export type TokenGenStatesConsumerClientWithGSIPKPurposeIdProjection = z.infer<
  typeof TokenGenStatesConsumerClientWithGSIPKPurposeIdProjection
>;
