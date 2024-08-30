import { z } from "zod";
import {
  AgreementId,
  ClientId,
  DescriptorId,
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
export const PlatformStatesEServiceDescriptorPK = z.literal(
  `ESERVICEDESCRIPTOR#${EServiceId}#${DescriptorId}`
);
export type PlatformStatesEServiceDescriptorPK = z.infer<
  typeof PlatformStatesEServiceDescriptorPK
>;

const a: PlatformStatesEServiceDescriptorPK = `ESERVICEDESCRIPTOR#${generateId<EServiceId>()}#${generateId<DescriptorId>()}`; // OK
const b: PlatformStatesEServiceDescriptorPK = `ESERVICEDESCRIPTOR#${generateId()}#${generateId<DescriptorId>()}`; // OK
const c: PlatformStatesEServiceDescriptorPK = `ESERVICEDESCRIPTOR#test#test`; // OK
const d: PlatformStatesEServiceDescriptorPK = `ESERVICEDESCRIPTOR#test#`; // OK
const e: PlatformStatesEServiceDescriptorPK = `ESERVICEDESCRIPTOR#test`; // WRONG
const f: PlatformStatesEServiceDescriptorPK = `test#test#test`; // WRONG

We don't check the structure of the ids because they are treated as strings
*/

export const PlatformStatesEServiceDescriptorPK = z
  .string()
  .brand(`ESERVICEDESCRIPTOR#eServiceId#descriptorId`);
export type PlatformStatesEServiceDescriptorPK = z.infer<
  typeof PlatformStatesEServiceDescriptorPK
>;

export const makePlatformStatesEServiceDescriptorPK = ({
  eserviceId,
  descriptorId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
}): PlatformStatesEServiceDescriptorPK =>
  `ESERVICEDESCRIPTOR#${eserviceId}#${descriptorId}` as PlatformStatesEServiceDescriptorPK;
export const PlatformStatesAgreementPK = z
  .string()
  .brand(`AGREEMENT#agreementId`);
export type PlatformStatesAgreementPK = z.infer<
  typeof PlatformStatesAgreementPK
>;
export const makePlatformStatesAgreementPK = (
  agreementId: AgreementId
): PlatformStatesAgreementPK =>
  `AGREEMENT#${agreementId}` as PlatformStatesAgreementPK;

export const PlatformStatesPurposePK = z.string().brand(`PURPOSE#purposeId`);
export type PlatformStatesPurposePK = z.infer<typeof PlatformStatesPurposePK>;
export const makePlatformStatesPurposePK = (
  purposeId: PurposeId
): PlatformStatesPurposePK => `PURPOSE#${purposeId}` as PlatformStatesPurposePK;

export const PlatformStatesClientPK = z.string().brand(`CLIENT#clientId`);
export type PlatformStatesClientPK = z.infer<typeof PlatformStatesClientPK>;
export const makePlatformStatesClientPK = (
  clientId: ClientId
): PlatformStatesClientPK => `CLIENT#${clientId}` as PlatformStatesClientPK;

export const PlatformStatesGSIPKConsumerIdEServiceId = z
  .string()
  .brand(`tenantId#eserviceId`);
export type PlatformStatesGSIPKConsumerIdEServiceId = z.infer<
  typeof PlatformStatesGSIPKConsumerIdEServiceId
>;
export const makePlatformStatesGSIPKConsumerIdEServiceId = ({
  consumerId,
  eserviceId,
}: {
  consumerId: TenantId;
  eserviceId: EServiceId;
}): PlatformStatesGSIPKConsumerIdEServiceId =>
  `${consumerId}#${eserviceId}` as PlatformStatesGSIPKConsumerIdEServiceId;

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
  GSIPK_consumerId_eserviceId: z.string(),
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
