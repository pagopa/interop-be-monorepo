import { z } from "zod";
import {
  AgreementId,
  ClientId,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";
import { ItemState } from "./platform-states-entry.js";
import {
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientKidPK,
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  GSIPKClientIdPurposeId,
} from "./dynamoDB-keys.js";

export const clientKindTokenStates = {
  consumer: "CONSUMER",
  api: "API",
} as const;
export const ClientKindTokenStates = z.enum([
  Object.values(clientKindTokenStates)[0],
  ...Object.values(clientKindTokenStates).slice(1),
]);
export type ClientKindTokenStates = z.infer<typeof ClientKindTokenStates>;

const TokenGenerationStatesBaseEntry = z.object({
  consumerId: TenantId,
  clientKind: ClientKindTokenStates,
  publicKey: z.string(),
  GSIPK_clientId: ClientId,
  GSIPK_kid: z.string(),
  updatedAt: z.string().datetime(),
});
type TokenGenerationStatesBaseEntry = z.infer<
  typeof TokenGenerationStatesBaseEntry
>;

export const TokenGenerationStatesClientPurposeEntry =
  TokenGenerationStatesBaseEntry.extend({
    PK: TokenGenerationStatesClientKidPurposePK,
    GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId.optional(),
    agreementId: AgreementId.optional(),
    agreementState: ItemState.optional(),
    GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId.optional(),
    descriptorState: ItemState.optional(),
    descriptorAudience: z.string().optional(),
    GSIPK_purposeId: PurposeId.optional(),
    purposeState: ItemState.optional(),
    purposeVersionId: PurposeVersionId.optional(),
    GSIPK_clientId_purposeId: GSIPKClientIdPurposeId.optional(),
  });
export type TokenGenerationStatesClientPurposeEntry = z.infer<
  typeof TokenGenerationStatesClientPurposeEntry
>;

export const TokenGenerationStatesClientEntry =
  TokenGenerationStatesBaseEntry.extend({
    PK: TokenGenerationStatesClientKidPK,
  });
export type TokenGenerationStatesClientEntry = z.infer<
  typeof TokenGenerationStatesClientPurposeEntry
>;
