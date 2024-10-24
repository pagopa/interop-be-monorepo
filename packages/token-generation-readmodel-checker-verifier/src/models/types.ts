import {
  PlatformStatesPurposeEntry,
  Purpose,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { z } from "zod";

// purpose
export const ReducedPurpose = Purpose.pick({
  id: true,
  consumerId: true,
  eserviceId: true,
  versions: true,
});
export type ReducedPurpose = z.infer<typeof ReducedPurpose>;

export const PlatformStatesPurposeEntryDiff = PlatformStatesPurposeEntry.pick({
  PK: true,
  state: true,
  purposeConsumerId: true,
  purposeEserviceId: true,
  purposeVersionId: true,
});
export type PlatformStatesPurposeEntryDiff = z.infer<
  typeof PlatformStatesPurposeEntryDiff
>;

export const TokenGenerationStatesPurposeEntryDiff =
  TokenGenerationStatesClientPurposeEntry.pick({
    PK: true,
    consumerId: true,
    GSIPK_purposeId: true,
    purposeState: true,
    purposeVersionId: true,
    GSIPK_clientId_purposeId: true,
  });
export type TokenGenerationStatesPurposeEntryDiff = z.infer<
  typeof TokenGenerationStatesPurposeEntryDiff
>;

export type PurposeDifferencesResult = Array<
  [
    PlatformStatesPurposeEntryDiff | undefined,
    TokenGenerationStatesPurposeEntryDiff[] | undefined,
    ReducedPurpose | undefined
  ]
>;
