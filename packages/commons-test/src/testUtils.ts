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
  Purpose,
  PurposeVersion,
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

export const buildDescriptorPublished = (
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

export const buildAgreement = (
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

export const getMockPurpose = (): Purpose => ({
  id: generateId(),
  eserviceId: generateId(),
  consumerId: generateId(),
  versions: [],
  title: "Purpose 1 - test",
  description: "Test purpose - description",
  createdAt: new Date(),
  isFreeOfCharge: true,
});

export const getMockPurposeVersion = (): PurposeVersion => ({
  id: generateId(),
  state: "Draft",
  riskAnalysis: {
    id: generateId(),
    contentType: "json",
    path: "path",
    createdAt: new Date(),
  },
  dailyCalls: 10,
  createdAt: new Date(),
});
