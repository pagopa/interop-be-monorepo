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
  GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
  updatedAt: z.string().datetime(),
});
type TokenGenerationStatesBaseEntry = z.infer<
  typeof TokenGenerationStatesBaseEntry
>;

export const TokenGenerationStatesClientPurposeEntry =
  TokenGenerationStatesBaseEntry.extend({
    PK: TokenGenerationStatesClientKidPurposePK,
    GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    agreementId: AgreementId,
    agreementState: ItemState,
    GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
    descriptorState: ItemState,
    descriptorAudience: z.string(),
    GSIPK_purposeId: PurposeId,
    purposeState: ItemState,
    purposeVersionId: PurposeVersionId,
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
