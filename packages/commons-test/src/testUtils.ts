/* eslint-disable functional/immutable-data */
import crypto from "crypto";
import { generateMock } from "@anatine/zod-mock";
import { AuthData } from "pagopa-interop-commons";
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
  PurposeVersionDocument,
  PurposeVersionState,
  Tenant,
  TenantAttribute,
  TenantId,
  VerifiedTenantAttribute,
  attributeKind,
  agreementState,
  descriptorState,
  generateId,
  purposeVersionState,
  Document,
  AgreementAttribute,
  tenantMailKind,
  TenantMailKind,
  Client,
  clientKind,
  keyUse,
  Key,
  technology,
  AttributeKind,
  itemState,
  ClientId,
  PurposeId,
  TokenGenerationStatesClientPurposeEntry,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKClientIdPurposeId,
  makeGSIPKEServiceIdDescriptorId,
  TokenGenerationStatesClientKidPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  clientKindTokenStates,
  AgreementId,
  PurposeVersionId,
  ProducerKeychain,
  DescriptorState,
} from "pagopa-interop-models";
import { z } from "zod";
import jwt from "jsonwebtoken";

export function expectPastTimestamp(timestamp: bigint): boolean {
  return (
    new Date(Number(timestamp)) && new Date(Number(timestamp)) <= new Date()
  );
}

export function randomArrayItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomBoolean(): boolean {
  return Math.random() < 0.5;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const getRandomAuthData = (
  organizationId: TenantId = generateId<TenantId>()
): AuthData => ({
  ...generateMock(AuthData),
  userRoles: ["admin"],
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

export const getMockAgreementAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): AgreementAttribute => ({
  id: attributeId,
});

export const getMockEServiceAttributes = (num: number): EServiceAttribute[] =>
  new Array(num).map(() => getMockEServiceAttribute());

export const getMockEService = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  producerId: TenantId = generateId<TenantId>(),
  descriptors: Descriptor[] = []
): EService => ({
  id: eserviceId,
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId,
  technology: technology.rest,
  descriptors,
  attributes: undefined,
  riskAnalysis: [],
  mode: "Deliver",
});

export const getMockVerifiedTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): VerifiedTenantAttribute => ({
  ...generateMock(VerifiedTenantAttribute),
  id: attributeId,
});

export const getMockCertifiedTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): CertifiedTenantAttribute => ({
  ...generateMock(CertifiedTenantAttribute),
  id: attributeId,
});

export const getMockDeclaredTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): DeclaredTenantAttribute => ({
  ...generateMock(DeclaredTenantAttribute),
  id: attributeId,
});

export const getMockTenant = (
  tenantId: TenantId = generateId<TenantId>(),
  attributes: TenantAttribute[] = []
): Tenant => ({
  name: "A tenant",
  id: tenantId,
  createdAt: new Date(),
  attributes,
  selfcareId: generateId(),
  onboardedAt: new Date(),
  externalId: {
    value: generateId(),
    origin: "IPA",
  },
  features: [],
  mails: [],
});

export const getMockTenantMail = (
  kind: TenantMailKind = tenantMailKind.ContactEmail
): Tenant["mails"][number] => ({
  id: generateId(),
  createdAt: new Date(),
  kind,
  description: generateMock(z.string()),
  address: generateMock(z.string().email()),
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

export const getMockAttribute = (
  kind: AttributeKind = attributeKind.certified,
  id: AttributeId = generateId()
): Attribute => ({
  id,
  name: "attribute name",
  kind,
  description: "attribute description",
  creationTime: new Date(),
  code: undefined,
  origin: undefined,
});

export const getMockPurpose = (versions?: PurposeVersion[]): Purpose => ({
  id: generateId(),
  eserviceId: generateId(),
  consumerId: generateId(),
  versions: versions ?? [],
  title: "Purpose 1 - test",
  description: "Test purpose - description",
  createdAt: new Date(),
  isFreeOfCharge: true,
  freeOfChargeReason: "test",
});

export const getMockPurposeVersion = (
  state?: PurposeVersionState
): PurposeVersion => ({
  id: generateId(),
  state: state || purposeVersionState.draft,
  riskAnalysis: {
    id: generateId(),
    contentType: "json",
    path: "path",
    createdAt: new Date(),
  },
  dailyCalls: 10,
  createdAt: new Date(),
  ...(state !== purposeVersionState.draft
    ? { updatedAt: new Date(), firstActivationAt: new Date() }
    : {}),
  ...(state === purposeVersionState.suspended
    ? { suspendedAt: new Date() }
    : {}),
  ...(state === purposeVersionState.rejected
    ? { rejectionReason: "test" }
    : {}),
});

export const getMockPurposeVersionDocument = (): PurposeVersionDocument => ({
  path: "path",
  id: generateId(),
  contentType: "json",
  createdAt: new Date(),
});

export const getMockDescriptor = (state?: DescriptorState): Descriptor => ({
  id: generateId(),
  version: "1",
  docs: [],
  state: state || descriptorState.draft,
  audience: [],
  voucherLifespan: 60,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 1000,
  createdAt: new Date(),
  serverUrls: ["pagopa.it"],
  agreementApprovalPolicy: "Automatic",
  attributes: {
    certified: [],
    verified: [],
    declared: [],
  },
});

export const getMockDescriptorList = (length?: number): Descriptor[] => {
  const arrayLength = length ?? Math.floor(Math.random() * 10) + 1;
  return Array.from({ length: arrayLength }, () => getMockDescriptor());
};

export const getMockDocument = (): Document => ({
  name: "fileName",
  path: "filePath",
  id: generateId(),
  prettyName: "prettyName",
  contentType: "json",
  checksum: "checksum",
  uploadDate: new Date(),
});

export const getMockClient = (): Client => ({
  id: generateId(),
  consumerId: generateId(),
  name: "Test client",
  purposes: [],
  description: "Client description",
  users: [],
  kind: clientKind.consumer,
  createdAt: new Date(),
  keys: [],
});

export const getMockProducerKeychain = (): ProducerKeychain => ({
  id: generateId(),
  producerId: generateId(),
  name: "Test producer keychain",
  eservices: [],
  description: "producer keychain description",
  users: [],
  createdAt: new Date(),
  keys: [],
});

export const getMockKey = (): Key => ({
  userId: generateId(),
  name: "test key",
  createdAt: new Date(),
  kid: `kid ${Math.random()}`,
  encodedPem: "encodedPem",
  algorithm: "",
  use: keyUse.sig,
});

export const getMockAuthData = (organizationId?: TenantId): AuthData => ({
  organizationId: organizationId || generateId(),
  userId: generateId(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  selfcareId: generateId(),
});

export const getMockTokenStatesClientPurposeEntry = (
  tokenStateEntryPK?: TokenGenerationStatesClientKidPurposePK
): TokenGenerationStatesClientPurposeEntry => {
  const clientId = generateId<ClientId>();
  const purposeId = generateId<PurposeId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const descriptorId = generateId<DescriptorId>();
  const agreementId = generateId<AgreementId>();
  const purposeVersionId = generateId<PurposeVersionId>();

  return {
    PK:
      tokenStateEntryPK ||
      makeTokenGenerationStatesClientKidPurposePK({
        clientId,
        kid: `kid ${Math.random()}`,
        purposeId,
      }),
    descriptorState: itemState.inactive,
    descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
    updatedAt: new Date().toISOString(),
    consumerId,
    agreementId,
    purposeVersionId,
    GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
      consumerId,
      eserviceId,
    }),
    clientKind: clientKindTokenStates.consumer,
    publicKey: "PEM",
    GSIPK_clientId: clientId,
    GSIPK_kid: "KID",
    agreementState: "ACTIVE",
    GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
      eserviceId,
      descriptorId,
    }),
    GSIPK_purposeId: purposeId,
    purposeState: itemState.inactive,
    GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
      clientId,
      purposeId,
    }),
  };
};

export function createJwtToken(): string {
  const header = {
    typ: "at+jwt",
    alg: "RS256",
    use: "sig",
    kid: "fcd1bab9-ae4d-49ce-9252-262db866e327",
  };

  const payload = {
    iss: "dev.interop.pagopa.it",
    externalId: {
      origin: "IPA",
      value: "5N2TR557",
    },
    "user-roles": "admin",
    selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
    organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
    aud: "dev.interop.pagopa.it/ui",
    uid: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
    nbf: Math.floor(Date.now() / 1000),
    organization: {
      id: "1962d21c-c701-4805-93f6-53a877898756",
      name: "PagoPA S.p.A.",
      roles: [
        {
          partyRole: "MANAGER",
          role: "admin",
        },
      ],
      fiscal_code: "15376371009",
      ipaCode: "5N2TR557",
    },
    name: "Ivan",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    family_name: "Diana",
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    email: "i.diana@psp.it",
  };

  const privateKey = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).privateKey;

  return jwt.sign(payload, privateKey, { algorithm: "RS256", header });
}
