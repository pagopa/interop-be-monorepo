import { z } from "zod";
import {
  EServiceId,
  DescriptorId,
  AgreementId,
  PurposeId,
  ClientId,
  TenantId,
} from "../brandedIds.js";

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

export const GSIPKConsumerIdEServiceId = z
  .string()
  .brand(`tenantId#eserviceId`);
export type GSIPKConsumerIdEServiceId = z.infer<
  typeof GSIPKConsumerIdEServiceId
>;
export const makeGSIPKConsumerIdEServiceId = ({
  consumerId,
  eserviceId,
}: {
  consumerId: TenantId;
  eserviceId: EServiceId;
}): GSIPKConsumerIdEServiceId =>
  `${consumerId}#${eserviceId}` as GSIPKConsumerIdEServiceId;

export const TokenGenerationStatesClientKidPurposePK = z
  .string()
  .brand(`ESERVICEDESCRIPTOR#eServiceId#descriptorId`);
export type TokenGenerationStatesClientKidPurposePK = z.infer<
  typeof TokenGenerationStatesClientKidPurposePK
>;
export const makeTokenGenerationStatesClientKidPurposePK = ({
  clientId,
  kid,
  purposeId,
}: {
  clientId: ClientId;
  kid: string;
  purposeId: PurposeId;
}): TokenGenerationStatesClientKidPurposePK =>
  `CLIENTKIDPURPOSE#${clientId}#${kid}#${purposeId}` as TokenGenerationStatesClientKidPurposePK;

export const TokenGenerationStatesClientKidPK = z
  .string()
  .brand(`ESERVICEDESCRIPTOR#eServiceId#descriptorId`);
export type TokenGenerationStatesClientKidPK = z.infer<
  typeof TokenGenerationStatesClientKidPK
>;
export const makeTokenGenerationStatesClientKidPK = ({
  clientId,
  kid,
}: {
  clientId: ClientId;
  kid: string;
}): TokenGenerationStatesClientKidPK =>
  `CLIENTKIDPURPOSE#${clientId}#${kid}` as TokenGenerationStatesClientKidPK;

export const GSIPKEServiceIdDescriptorId = z
  .string()
  .brand(`eserviceId#descriptorId`);
export type GSIPKEServiceIdDescriptorId = z.infer<
  typeof GSIPKEServiceIdDescriptorId
>;
export const makeGSIPKEServiceIdDescriptorId = ({
  eserviceId,
  descriptorId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
}): GSIPKEServiceIdDescriptorId =>
  `${eserviceId}#${descriptorId}` as GSIPKEServiceIdDescriptorId;

export const GSIPKClientIdPurposeId = z.string().brand(`clientId#purposeId`);
export type GSIPKClientIdPurposeId = z.infer<typeof GSIPKClientIdPurposeId>;
export const makeGSIPKClientIdPurposeId = ({
  clientId,
  purposeId,
}: {
  clientId: ClientId;
  purposeId: PurposeId;
}): GSIPKClientIdPurposeId =>
  `${clientId}#${purposeId}` as GSIPKClientIdPurposeId;
