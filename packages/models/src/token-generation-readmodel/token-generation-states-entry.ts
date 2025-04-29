import { z } from "zod";
import {
  AgreementId,
  ClientId,
  GSIPKClientIdPurposeId,
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  GSIPKClientIdKid,
  PurposeId,
  PurposeVersionId,
  TenantId,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  UserId,
} from "../brandedIds.js";
import { ItemState } from "./platform-states-entry.js";
import { clientKindTokenGenStates } from "./commons.js";

const TokenGenerationStatesBaseEntry = z.object({
  publicKey: z.string(),
  GSIPK_clientId: ClientId,
  GSIPK_clientId_kid: GSIPKClientIdKid,
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
    consumerId: TenantId.optional(),
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
    consumerId: TenantId,
    adminId: UserId.optional(),
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
export const TokenGenStatesConsumerClientGSIAgreement =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_consumerId_eserviceId: true,
    agreementState: true,
    descriptorState: true,
    descriptorAudience: true,
    descriptorVoucherLifespan: true,
  });
export type TokenGenStatesConsumerClientGSIAgreement = z.infer<
  typeof TokenGenStatesConsumerClientGSIAgreement
>;

// ClientPurpose
export const TokenGenStatesConsumerClientGSIClientPurpose =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_clientId_purposeId: true,
    GSIPK_clientId: true,
    GSIPK_clientId_kid: true,
    GSIPK_purposeId: true,
    consumerId: true,
    clientKind: true,
    publicKey: true,
  });
export type TokenGenStatesConsumerClientGSIClientPurpose = z.infer<
  typeof TokenGenStatesConsumerClientGSIClientPurpose
>;

// Descriptor
export const TokenGenStatesConsumerClientGSIDescriptor =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_eserviceId_descriptorId: true,
  });
export type TokenGenStatesConsumerClientGSIDescriptor = z.infer<
  typeof TokenGenStatesConsumerClientGSIDescriptor
>;

// ClientKid
export const TokenGenStatesApiClientGSIClientKid =
  TokenGenerationStatesApiClient.pick({
    PK: true,
    GSIPK_clientId_kid: true,
  });
export type TokenGenStatesApiClientGSIClientIdKid = z.infer<
  typeof TokenGenStatesApiClientGSIClientKid
>;

export const TokenGenStatesConsumerClientGSIClientKid =
  TokenGenerationStatesConsumerClient.pick({
    PK: true,
    GSIPK_clientId_kid: true,
  });
export type TokenGenStatesConsumerClientGSIClientKid = z.infer<
  typeof TokenGenStatesConsumerClientGSIClientKid
>;

export const TokenGenStatesGenericClientGSIClientKid =
  TokenGenStatesApiClientGSIClientKid.or(
    TokenGenStatesConsumerClientGSIClientKid
  );
export type TokenGenStatesGenericClientGSIClientKid = z.infer<
  typeof TokenGenStatesGenericClientGSIClientKid
>;

// Purpose
export const TokenGenStatesConsumerClientGSIPurpose =
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
export type TokenGenStatesConsumerClientGSIPurpose = z.infer<
  typeof TokenGenStatesConsumerClientGSIPurpose
>;
