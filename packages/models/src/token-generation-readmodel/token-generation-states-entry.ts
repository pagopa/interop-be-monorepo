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
