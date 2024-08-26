import { z } from "zod";
import { ClientKind } from "../authorization/client.js";
import { PurposeVersionId } from "../brandedIds.js";
import { ItemState } from "./platform-states-entry.js";

const TokenGenerationStatesBaseEntry = z.object({
  PK: z.string(),
  consumerId: z.string(),
  clientKind: ClientKind,
  publicKey: z.string(),
  GSIPK_clientId: z.string(),
  GSIPK_kid: z.string(),
  GSIPK_clientId_purposeId: z.string(),
});
type TokenGenerationStatesBaseEntry = z.infer<
  typeof TokenGenerationStatesBaseEntry
>;

export const TokenGenerationStatesClientPurposeEntry =
  TokenGenerationStatesBaseEntry &&
  z.object({
    GSIPK_consumerId_eserviceId: z.string(),
    agreementState: ItemState,
    GSIPK_eserviceId_descriptorId: z.string(),
    descriptorState: ItemState,
    descriptorAudience: z.string(),
    GSIPK_purposeId: z.string(),
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
