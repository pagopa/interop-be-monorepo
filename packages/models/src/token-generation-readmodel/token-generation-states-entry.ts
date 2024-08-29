import { z } from "zod";
import { ClientKind } from "../authorization/client.js";
import {
  AgreementId,
  ClientId,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";
import { ItemState } from "./platform-states-entry.js";

const TokenGenerationStatesBaseEntry = z.object({
  PK: z.string(),
  consumerId: TenantId,
  clientKind: ClientKind,
  publicKey: z.string(),
  GSIPK_clientId: ClientId,
  GSIPK_kid: z.string(),
  GSIPK_clientId_purposeId: z.string(),
  updatedAt: z.string().datetime(),
});
type TokenGenerationStatesBaseEntry = z.infer<
  typeof TokenGenerationStatesBaseEntry
>;

export const TokenGenerationStatesClientPurposeEntry =
  TokenGenerationStatesBaseEntry.extend({
    GSIPK_consumerId_eserviceId: z.string(),
    agreementId: AgreementId,
    agreementState: ItemState,
    GSIPK_eserviceId_descriptorId: z.string(),
    descriptorState: ItemState,
    descriptorAudience: z.string(),
    GSIPK_purposeId: PurposeId,
    purposeState: ItemState,
    purposeVersionId: PurposeVersionId,
  });
export type TokenGenerationStatesClientPurposeEntry = z.infer<
  typeof TokenGenerationStatesClientPurposeEntry
>;

export const TokenGenerationStatesClientEntry = TokenGenerationStatesBaseEntry;
export type TokenGenerationStatesClientEntry = z.infer<
  typeof TokenGenerationStatesClientPurposeEntry
>;
