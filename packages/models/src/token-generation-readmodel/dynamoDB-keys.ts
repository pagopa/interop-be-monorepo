import {
  EServiceId,
  DescriptorId,
  AgreementId,
  PurposeId,
  ClientId,
  TenantId,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesAgreementPK,
  PlatformStatesPurposePK,
  PlatformStatesClientPK,
  GSIPKConsumerIdEServiceId,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientKidPK,
  GSIPKEServiceIdDescriptorId,
  GSIPKClientIdPurposeId,
  unsafeBrandId,
} from "../brandedIds.js";

export const makePlatformStatesEServiceDescriptorPK = ({
  eserviceId,
  descriptorId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
}): PlatformStatesEServiceDescriptorPK =>
  `ESERVICEDESCRIPTOR#${eserviceId}#${descriptorId}` as PlatformStatesEServiceDescriptorPK;

export const makePlatformStatesAgreementPK = (
  agreementId: AgreementId
): PlatformStatesAgreementPK =>
  unsafeBrandId<PlatformStatesAgreementPK>(`AGREEMENT#${agreementId}`);

export const makePlatformStatesPurposePK = (
  purposeId: PurposeId
): PlatformStatesPurposePK =>
  unsafeBrandId<PlatformStatesPurposePK>(`PURPOSE#${purposeId}`);

export const makePlatformStatesClientPK = (
  clientId: ClientId
): PlatformStatesClientPK => unsafeBrandId(`CLIENT#${clientId}`);

export const makeGSIPKConsumerIdEServiceId = ({
  consumerId,
  eserviceId,
}: {
  consumerId: TenantId;
  eserviceId: EServiceId;
}): GSIPKConsumerIdEServiceId => unsafeBrandId(`${consumerId}#${eserviceId}`);

export const makeTokenGenerationStatesClientKidPurposePK = ({
  clientId,
  kid,
  purposeId,
}: {
  clientId: ClientId;
  kid: string;
  purposeId: PurposeId;
}): TokenGenerationStatesClientKidPurposePK =>
  unsafeBrandId(`CLIENTKIDPURPOSE#${clientId}#${kid}#${purposeId}`);

export const makeTokenGenerationStatesClientKidPK = ({
  clientId,
  kid,
}: {
  clientId: ClientId;
  kid: string;
}): TokenGenerationStatesClientKidPK =>
  unsafeBrandId(`CLIENTKID#${clientId}#${kid}`);

export const makeGSIPKEServiceIdDescriptorId = ({
  eserviceId,
  descriptorId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
}): GSIPKEServiceIdDescriptorId =>
  unsafeBrandId(`${eserviceId}#${descriptorId}`);

export const makeGSIPKClientIdPurposeId = ({
  clientId,
  purposeId,
}: {
  clientId: ClientId;
  purposeId: PurposeId;
}): GSIPKClientIdPurposeId => unsafeBrandId(`${clientId}#${purposeId}`);
