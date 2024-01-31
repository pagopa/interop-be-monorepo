import {
  Agreement,
  AttributeId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  DescriptorId,
  EService,
  EServiceAttribute,
  EServiceId,
  Tenant,
  TenantAttribute,
  TenantId,
  VerifiedTenantAttribute,
  agreementCreationConflictingStates,
  agreementState,
  descriptorState,
  generateId,
  tenantAttributeType,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { AuthData } from "../index.js";

export function expectPastTimestamp(timestamp: bigint): boolean {
  return (
    new Date(Number(timestamp)) && new Date(Number(timestamp)) <= new Date()
  );
}

export function randomArrayItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export const getRandomAuthData = (
  organizationId: TenantId = generateId<TenantId>()
): AuthData => ({
  ...generateMock(AuthData),
  organizationId,
});

export const buildDescriptorPublished = (
  descriptorId: DescriptorId = generateId<DescriptorId>(),
  certifiedAttributes: EServiceAttribute[] = [],
  declaredAttributes: EServiceAttribute[] = [],
  verifiedAttributes: EServiceAttribute[] = []
): Descriptor => ({
  ...generateMock(Descriptor),
  id: descriptorId,
  state: descriptorState.published,
  attributes: {
    certified: certifiedAttributes.length ? [certifiedAttributes] : [],
    declared: declaredAttributes.length ? [declaredAttributes] : [],
    verified: declaredAttributes.length ? [verifiedAttributes] : [],
  },
});

export const buildEServiceAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): EServiceAttribute => ({
  ...generateMock(EServiceAttribute),
  id: attributeId,
});

export const buildEServiceAttributes = (num: number): EServiceAttribute[] =>
  new Array(num).map(() => buildEServiceAttribute());

export const buildEService = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  producerId: TenantId = generateId<TenantId>(),
  descriptors: Descriptor[] = []
): EService => ({
  ...generateMock(EService),
  id: eserviceId,
  producerId,
  descriptors,
});

export const buildVerifiedTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): TenantAttribute => ({
  ...generateMock(VerifiedTenantAttribute),
  id: attributeId,
});

export const buildVerifiedTenantAttributes = (num: number): TenantAttribute[] =>
  new Array(num).map(() => buildVerifiedTenantAttribute());

export const buildCertifiedTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): CertifiedTenantAttribute => ({
  ...generateMock(CertifiedTenantAttribute),
  id: attributeId,
  type: tenantAttributeType.CERTIFIED,
  revocationTimestamp: undefined,
});

export const buildCertifiedTenantAttributes = (
  num: number
): TenantAttribute[] =>
  new Array(num).map(() => buildCertifiedTenantAttribute());

export const buildDeclaredTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): TenantAttribute => ({
  ...generateMock(DeclaredTenantAttribute),
  id: attributeId,
});

export const buildDeclaredTenantAttributes = (num: number): TenantAttribute[] =>
  new Array(num).map(() => buildDeclaredTenantAttribute());

export const buildTenant = (
  tenantId: TenantId = generateId<TenantId>(),
  externalId: TenantId = generateId<TenantId>(),
  attributes: TenantAttribute[] = []
): Tenant => ({
  ...generateMock(Tenant),
  id: tenantId,
  externalId: {
    value: externalId,
    origin: "EXT",
  },
  attributes,
});

export const buildAgreementWithValidCreationState = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  consumerId: TenantId = generateId<TenantId>()
): Agreement => ({
  ...generateMock(Agreement),
  eserviceId,
  consumerId,
  state: randomArrayItem(
    Object.values(agreementState).filter(
      (state) => !agreementCreationConflictingStates.includes(state)
    )
  ),
});
