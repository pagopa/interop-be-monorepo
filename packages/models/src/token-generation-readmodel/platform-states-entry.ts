import { z } from "zod";
import {
  EServiceId,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";
import {
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesPurposePK,
  PlatformStatesAgreementPK,
  GSIPKConsumerIdEServiceId,
  PlatformStatesClientPK,
} from "./dynamoDB-keys.js";

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
  state: ItemState,
  version: z.number(),
  updatedAt: z.string().datetime(),
});
type PlatformStatesBaseEntry = z.infer<typeof PlatformStatesBaseEntry>;

export const PlatformStatesCatalogEntry = PlatformStatesBaseEntry.extend({
  PK: PlatformStatesEServiceDescriptorPK,
  descriptorAudience: z.string(),
});
export type PlatformStatesCatalogEntry = z.infer<
  typeof PlatformStatesCatalogEntry
>;

export const PlatformStatesPurposeEntry = PlatformStatesBaseEntry.extend({
  PK: PlatformStatesPurposePK,
  purposeVersionId: PurposeVersionId,
  purposeEserviceId: EServiceId,
  purposeConsumerId: TenantId,
});
export type PlatformStatesPurposeEntry = z.infer<
  typeof PlatformStatesPurposeEntry
>;

export const PlatformStatesAgreementEntry = PlatformStatesBaseEntry.extend({
  PK: PlatformStatesAgreementPK,
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId,
  GSISK_agreementTimestamp: z.string().datetime(),
  agreementDescriptorId: z.string(),
});
export type PlatformStatesAgreementEntry = z.infer<
  typeof PlatformStatesAgreementEntry
>;

export const PlatformStatesClientEntry = PlatformStatesBaseEntry.extend({
  PK: PlatformStatesClientPK,
  clientPurposesIds: z.array(PurposeId),
});
export type PlatformStatesClientEntry = z.infer<
  typeof PlatformStatesClientEntry
>;
