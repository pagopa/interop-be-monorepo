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

/*
type PrimaryKeyPlatformStates =
  | `ESERVICEDESCRIPTOR#${EServiceId}#${DescriptorId}`
  | `AGREEMENT#${AgreementId}`
  | `PURPOSE#${PurposeId}`
  | `CLIENT#${ClientId}`;
*/

const PlatformStatesBaseEntry = z.object({
  PK: z.string(),
  state: ItemState,
  version: z.number(),
  updatedAt: z.string().datetime(),
});
type PlatformStatesBaseEntry = z.infer<typeof PlatformStatesBaseEntry>;

export const PlatformStatesCatalogEntry = PlatformStatesBaseEntry.extend({
  descriptorAudience: z.string(),
});
export type PlatformStatesCatalogEntry = z.infer<
  typeof PlatformStatesCatalogEntry
>;

export const PlatformStatesPurposeEntry = PlatformStatesBaseEntry.extend({
  purposeVersionId: PurposeVersionId,
  purposeEserviceId: EServiceId,
  purposeConsumerId: TenantId,
});
export type PlatformStatesPurposeEntry = z.infer<
  typeof PlatformStatesPurposeEntry
>;

export const PlatformStatesAgreementEntry = PlatformStatesBaseEntry.extend({
  GSIPK_consumerId_eserviceId: z.string(),
  GSISK_agreementTimestamp: z.string().datetime(),
  agreementDescriptorId: z.string(),
});
export type PlatformStatesAgreementEntry = z.infer<
  typeof PlatformStatesAgreementEntry
>;

export const PlatformStatesClientEntry = PlatformStatesBaseEntry.extend({
  clientPurposesIds: z.array(PurposeId),
});
export type PlatformStatesClientEntry = z.infer<
  typeof PlatformStatesClientEntry
>;
