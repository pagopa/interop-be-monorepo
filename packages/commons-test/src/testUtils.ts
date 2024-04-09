import { generateMock } from "@anatine/zod-mock";
import {
  Agreement,
  AgreementState,
  Attribute,
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
  attributeKind,
  agreementState,
  descriptorState,
  generateId,
  tenantAttributeType,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { AuthData } from "pagopa-interop-commons";

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

export const getMockDescriptorPublished = (
  descriptorId: DescriptorId = generateId<DescriptorId>(),
  certifiedAttributes: EServiceAttribute[][] = [],
  declaredAttributes: EServiceAttribute[][] = [],
  verifiedAttributes: EServiceAttribute[][] = []
): Descriptor => ({
  ...generateMock(Descriptor),
  id: descriptorId,
  state: descriptorState.published,
  attributes: {
    certified: certifiedAttributes,
    declared: declaredAttributes,
    verified: verifiedAttributes,
  },
});

export const getMockEServiceAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): EServiceAttribute => ({
  ...generateMock(EServiceAttribute),
  id: attributeId,
});

export const getMockEServiceAttributes = (num: number): EServiceAttribute[] =>
  new Array(num).map(() => getMockEServiceAttribute());

export const getMockEService = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  producerId: TenantId = generateId<TenantId>(),
  descriptors: Descriptor[] = []
): EService => ({
  ...generateMock(EService),
  id: eserviceId,
  producerId,
  descriptors,
});

export const getMockVerifiedTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): TenantAttribute => ({
  ...generateMock(VerifiedTenantAttribute),
  id: attributeId,
});

export const getMockVerifiedTenantAttributes = (
  num: number
): TenantAttribute[] =>
  new Array(num).map(() => getMockVerifiedTenantAttribute());

export const getMockCertifiedTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): CertifiedTenantAttribute => ({
  ...generateMock(CertifiedTenantAttribute),
  id: attributeId,
  type: tenantAttributeType.CERTIFIED,
  revocationTimestamp: undefined,
});

export const getMockCertifiedTenantAttributes = (
  num: number
): TenantAttribute[] =>
  new Array(num).map(() => getMockCertifiedTenantAttribute());

export const getMockDeclaredTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): TenantAttribute => ({
  ...generateMock(DeclaredTenantAttribute),
  id: attributeId,
});

export const getMockDeclaredTenantAttributes = (
  num: number
): TenantAttribute[] =>
  new Array(num).map(() => getMockDeclaredTenantAttribute());

export const getMockTenant = (
  tenantId: TenantId = generateId<TenantId>(),
  attributes: TenantAttribute[] = []
): Tenant => ({
  ...generateMock(Tenant),
  id: tenantId,
  externalId: {
    value: uuidv4(),
    origin: "EXT",
  },
  attributes,
});

export const getMockAgreement = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  consumerId: TenantId = generateId<TenantId>(),
  state: AgreementState = agreementState.draft
): Agreement => ({
  ...generateMock(Agreement),
  eserviceId,
  consumerId,
  state,
});

export const getMockAttribute = (): Attribute => ({
  id: generateId(),
  name: "attribute name",
  kind: attributeKind.certified,
  description: "attribute description",
  creationTime: new Date(),
  code: undefined,
  origin: undefined,
});
