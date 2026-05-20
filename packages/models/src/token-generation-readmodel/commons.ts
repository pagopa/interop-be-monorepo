import { z } from "zod";
import {
  ClientId,
  DescriptorId,
  EServiceId,
  GSIPKInteractionId,
  InteractionId,
  InteractionsPK,
  GSIPKClientIdKid,
  GSIPKClientIdPurposeId,
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  PlatformStatesAgreementPK,
  PlatformStatesClientPK,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesPurposePK,
  ProducerKeychainId,
  ProducerKeychainPlatformStatesPK,
  PurposeId,
  TenantId,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  unsafeBrandId,
} from "../brandedIds.js";

export const makePlatformStatesEServiceDescriptorPK = ({
  eserviceId,
  descriptorId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
}): PlatformStatesEServiceDescriptorPK =>
  unsafeBrandId<PlatformStatesEServiceDescriptorPK>(
    `ESERVICEDESCRIPTOR#${eserviceId}#${descriptorId}`
  );

export const makePlatformStatesAgreementPK = ({
  consumerId,
  eserviceId,
}: {
  consumerId: TenantId;
  eserviceId: EServiceId;
}): PlatformStatesAgreementPK =>
  unsafeBrandId<PlatformStatesAgreementPK>(
    `AGREEMENT#${consumerId}#${eserviceId}`
  );

export const makePlatformStatesPurposePK = (
  purposeId: PurposeId
): PlatformStatesPurposePK =>
  unsafeBrandId<PlatformStatesPurposePK>(`PURPOSE#${purposeId}`);

export const makePlatformStatesClientPK = (
  clientId: ClientId
): PlatformStatesClientPK =>
  unsafeBrandId<PlatformStatesClientPK>(`CLIENT#${clientId}`);

export const makeGSIPKConsumerIdEServiceId = ({
  consumerId,
  eserviceId,
}: {
  consumerId: TenantId;
  eserviceId: EServiceId;
}): GSIPKConsumerIdEServiceId =>
  unsafeBrandId<GSIPKConsumerIdEServiceId>(`${consumerId}#${eserviceId}`);

export const makeTokenGenerationStatesClientKidPurposePK = ({
  clientId,
  kid,
  purposeId,
}: {
  clientId: ClientId;
  kid: string;
  purposeId: PurposeId;
}): TokenGenerationStatesClientKidPurposePK =>
  unsafeBrandId<TokenGenerationStatesClientKidPurposePK>(
    `CLIENTKIDPURPOSE#${clientId}#${kid}#${purposeId}`
  );

export const makeTokenGenerationStatesClientKidPK = ({
  clientId,
  kid,
}: {
  clientId: ClientId;
  kid: string;
}): TokenGenerationStatesClientKidPK =>
  unsafeBrandId<TokenGenerationStatesClientKidPK>(
    `CLIENTKID#${clientId}#${kid}`
  );

export const makeProducerKeychainPlatformStatesPK = ({
  producerKeychainId,
  kid,
  eServiceId,
}: {
  producerKeychainId: ProducerKeychainId;
  kid: string;
  eServiceId: EServiceId;
}): ProducerKeychainPlatformStatesPK =>
  unsafeBrandId<ProducerKeychainPlatformStatesPK>(
    `PRODUCERKEYCHAINKIDESERVICE#${producerKeychainId}#${kid}#${eServiceId}`
  );

export const makeInteractionPK = (
  interactionId: InteractionId
): InteractionsPK =>
  unsafeBrandId<InteractionsPK>(`INTERACTION#${interactionId}`);

export const makeGSIPKInteractionId = (
  interactionId: InteractionId
): GSIPKInteractionId => unsafeBrandId<GSIPKInteractionId>(interactionId);

export const makeGSIPKEServiceIdDescriptorId = ({
  eserviceId,
  descriptorId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
}): GSIPKEServiceIdDescriptorId =>
  unsafeBrandId<GSIPKEServiceIdDescriptorId>(`${eserviceId}#${descriptorId}`);

export const makeGSIPKClientIdPurposeId = ({
  clientId,
  purposeId,
}: {
  clientId: ClientId;
  purposeId: PurposeId;
}): GSIPKClientIdPurposeId =>
  unsafeBrandId<GSIPKClientIdPurposeId>(`${clientId}#${purposeId}`);

export const makeGSIPKClientIdKid = ({
  clientId,
  kid,
}: {
  clientId: ClientId;
  kid: string;
}): GSIPKClientIdKid => unsafeBrandId<GSIPKClientIdKid>(`${clientId}#${kid}`);

export const clientKindTokenGenStates = {
  consumer: "CONSUMER",
  api: "API",
} as const;
export const ClientKindTokenGenStates = z.enum([
  Object.values(clientKindTokenGenStates)[0],
  ...Object.values(clientKindTokenGenStates).slice(1),
]);
export type ClientKindTokenGenStates = z.infer<typeof ClientKindTokenGenStates>;
