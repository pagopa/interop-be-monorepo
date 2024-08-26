import { z } from "zod";
import {
  EServiceId,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";

export const itemState = {
  active: "ACTIVE",
  inactive: "INACTIVE",
} as const;
export const ItemState = z.enum([
  Object.values(itemState)[0],
  ...Object.values(itemState).slice(1),
]);
export type ItemState = z.infer<typeof ItemState>;

const PlatformStatesBaseEntry = z.object({
  PK: z.string(),
  state: ItemState,
});
type PlatformStatesBaseEntry = z.infer<typeof PlatformStatesBaseEntry>;

export const PlatformStatesCatalogEntry =
  PlatformStatesBaseEntry &&
  z.object({
    descriptorAudience: z.string(),
  });
export type PlatformStatesCatalogEntry = z.infer<
  typeof PlatformStatesCatalogEntry
>;

export const PlatformStatesPurposeEntry =
  PlatformStatesBaseEntry &&
  z.object({
    purposeVersionId: PurposeVersionId,
    purposeEserviceId: EServiceId,
    purposeConsumerId: TenantId,
  });
export type PlatformStatesPurposeEntry = z.infer<
  typeof PlatformStatesPurposeEntry
>;

export const PlatformStatesAgreementEntry =
  PlatformStatesBaseEntry &&
  z.object({
    GSIPK_consumerId_eserviceId: z.string(),
    GSISK_agreementTimestamp: z.string(),
    agreementDescriptorId: z.string(),
  });
export type PlatformStatesAgreementEntry = z.infer<
  typeof PlatformStatesAgreementEntry
>;

export const PlatformStatesClientEntry =
  PlatformStatesBaseEntry &&
  z.object({
    clientPurposesIds: z.array(PurposeId),
  });
export type PlatformStatesClientEntry = z.infer<
  typeof PlatformStatesClientEntry
>;
