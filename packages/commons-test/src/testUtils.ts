/* eslint-disable fp/no-delete */
import crypto from "crypto";
import { fail } from "assert";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
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
  TokenGenerationStatesConsumerClient,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKClientIdPurposeId,
  makeGSIPKEServiceIdDescriptorId,
  TokenGenerationStatesClientKidPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  clientKindTokenGenStates,
  AgreementId,
  PurposeVersionId,
  ProducerKeychain,
  Delegation,
  DelegationId,
  DelegationContractDocument,
  DelegationContractId,
  DelegationState,
  TenantFeatureCertifier,
  TenantFeature,
  DescriptorState,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  makeGSIPKClientIdKid,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesApiClient,
  makeTokenGenerationStatesClientKidPK,
  PlatformStatesClientPK,
  PlatformStatesClientEntry,
  makePlatformStatesClientPK,
  AgreementStamps,
  DelegationKind,
  unsafeBrandId,
  UserId,
  delegationState,
  delegationKind,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  agreementApprovalPolicy,
  EServiceTemplateVersionState,
  AgreementDocument,
  DescriptorRejectionReason,
  AgreementStamp,
  ClientJWKKey,
  ProducerJWKKey,
  ProducerKeychainId,
  WithMetadata,
  CorrelationId,
  AgreementV2,
  VerifiedAttributeV2,
  DeclaredAttributeV2,
  CertifiedAttributeV2,
  AgreementDocumentV2,
  PurposeV2,
  EserviceAttributes,
  DPoPProof,
  DPoPProofPayload,
  DPoPProofHeader,
  JWKKeyRS256,
  JWKKeyES256,
  Algorithm,
  algorithm,
  ClientKind,
  NotificationConfig,
  TenantNotificationConfig,
  UserNotificationConfig,
  DelegationStamps,
  PurposeVersionStamps,
  PurposeTemplate,
  tenantKind,
  purposeTemplateState,
  PurposeTemplateState,
  PurposeTemplateV2,
  RiskAnalysisTemplateSingleAnswer,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswerV2,
  RiskAnalysisTemplateMultiAnswerV2,
  AgreementSignedContract,
  PurposeVersionSignedDocument,
  DelegationSignedContractDocument,
} from "pagopa-interop-models";
import {
  AppContext,
  dateToSeconds,
  genericLogger,
  keyToClientJWKKey,
  keyToProducerJWKKey,
  InternalAuthData,
  M2MAuthData,
  MaintenanceAuthData,
  systemRole,
  UIAuthData,
  UserRole,
  userRole,
  WithLogger,
  UIClaims,
  M2MAdminAuthData,
  createJWK,
} from "pagopa-interop-commons";
import { z } from "zod";
import * as jose from "jose";
import { match } from "ts-pattern";

export function expectPastTimestamp(timestamp: bigint): boolean {
  return (
    new Date(Number(timestamp)) && new Date(Number(timestamp)) <= new Date()
  );
}

export function randomSubArray<T>(array: T[]): T[] {
  const count = Math.floor(Math.random() * array.length) + 1;
  const start = Math.floor(Math.random() * (array.length - count + 1));
  return array.slice(start, start + count);
}

export function randomArrayItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomBoolean(): boolean {
  return Math.random() < 0.5;
}

export const getTenantCertifierFeatures = (
  tenant: Tenant
): TenantFeatureCertifier[] =>
  tenant.features.reduce(
    (acc: TenantFeatureCertifier[], feature: TenantFeature) =>
      match(feature.type)
        .with("PersistentCertifier", () => [
          ...acc,
          feature as TenantFeatureCertifier,
        ])
        .with("DelegatedProducer", () => acc)
        .with("DelegatedConsumer", () => acc)
        .exhaustive(),
    []
  );

export const getTenantOneCertifierFeature = (
  tenant: Tenant
): TenantFeatureCertifier => {
  const certifiedFeatures = getTenantCertifierFeatures(tenant);
  if (certifiedFeatures.length === 0) {
    fail("Expected certifier feature not found in Tenant");
  }
  return certifiedFeatures[0];
};

export const getMockDescriptorPublished = (
  descriptorId: DescriptorId = generateId<DescriptorId>(),
  certifiedAttributes: EServiceAttribute[][] = [],
  declaredAttributes: EServiceAttribute[][] = [],
  verifiedAttributes: EServiceAttribute[][] = []
): Descriptor => ({
  ...getMockDescriptor(descriptorState.published),
  id: descriptorId,
  state: descriptorState.published,
  attributes: {
    certified: certifiedAttributes,
    declared: declaredAttributes,
    verified: verifiedAttributes,
  },
  rejectionReasons: undefined,
  voucherLifespan: 600,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 10000,
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

export const getMockEServiceAttributes = (): EserviceAttributes => ({
  certified: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
  declared: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
  verified: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
});

export const getMockEService = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  producerId: TenantId = generateId<TenantId>(),
  descriptors: Descriptor[] = [],
  templateId?: EServiceTemplateId | undefined
): EService => ({
  id: eserviceId,
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId,
  technology: technology.rest,
  descriptors,
  riskAnalysis: [],
  mode: "Deliver",
  ...(templateId && { templateId }),
  ...(templateId && { instanceLabel: "instance 001" }),
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

export const getMockAgreementStamp = (): AgreementStamp => ({
  who: generateId(),
  when: new Date(),
  delegationId: generateId<DelegationId>(),
});

export const getMockAgreementStamps = (): AgreementStamps => {
  const stamps = generateMock(AgreementStamps);
  delete stamps.submission?.delegationId;
  delete stamps.activation?.delegationId;
  delete stamps.rejection?.delegationId;
  delete stamps.suspensionByConsumer?.delegationId;
  delete stamps.suspensionByProducer?.delegationId;
  delete stamps.upgrade?.delegationId;
  delete stamps.archiving?.delegationId;
  return stamps;
};

export const getMockAgreement = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  consumerId: TenantId = generateId<TenantId>(),
  state: AgreementState = agreementState.draft
): Agreement => ({
  ...generateMock(Agreement),
  eserviceId,
  consumerId,
  state,
  stamps: getMockAgreementStamps(),
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

export const getMockPurposeTemplate = (
  creatorId: TenantId = generateId<TenantId>(),
  state: PurposeTemplateState = purposeTemplateState.draft,
  handlesPersonalData: boolean = true
): PurposeTemplate => ({
  id: generateId(),
  targetDescription: "Purpose template target description",
  targetTenantKind: tenantKind.PA,
  creatorId,
  state,
  createdAt: new Date(),
  purposeTitle: "Purpose template title",
  purposeDescription: "Purpose template description",
  purposeIsFreeOfCharge: false,
  handlesPersonalData,
});

export const getMockPurposeVersion = (
  state?: PurposeVersionState,
  stamps?: PurposeVersionStamps
): PurposeVersion => ({
  id: generateId(),
  state: state || purposeVersionState.draft,
  riskAnalysis: getMockPurposeVersionDocument(),
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
  ...(stamps ? { stamps } : {}),
});

export const getMockPurposeVersionDocument = (): PurposeVersionDocument => ({
  path: "path",
  id: generateId(),
  contentType: "json",
  createdAt: new Date(),
});

export const getMockPurposeVersionSignedDocument =
  (): PurposeVersionSignedDocument => ({
    path: "path",
    id: generateId(),
    contentType: "json",
    createdAt: new Date(),
    signedAt: new Date(),
  });

export const getMockPurposeVersionStamps = (): PurposeVersionStamps =>
  generateMock(PurposeVersionStamps);

export const getMockDescriptor = (state?: DescriptorState): Descriptor => ({
  id: generateId(),
  version: "1",
  docs: [],
  state: state || descriptorState.draft,
  audience: ["pagopa.it"],
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
  ...(state === descriptorState.archived ? { archivedAt: new Date() } : {}),
  ...(state === descriptorState.suspended ? { suspendedAt: new Date() } : {}),
  ...(state === descriptorState.deprecated ? { deprecatedAt: new Date() } : {}),
  ...(state === descriptorState.published ? { publishedAt: new Date() } : {}),
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

export const getMockAgreementDocument = (): AgreementDocument => ({
  id: generateId(),
  name: "fileName",
  prettyName: "prettyName",
  contentType: "json",
  path: "filePath",
  createdAt: new Date(),
});

export const getMockAgreementContract = (): AgreementSignedContract => ({
  id: generateId(),
  name: "fileName",
  prettyName: "prettyName",
  contentType: "json",
  path: "filePath",
  createdAt: new Date(),
  signedAt: new Date(),
});

export const getMockClient = ({
  consumerId = generateId<TenantId>(),
  users = [],
  kind = clientKind.consumer,
  purposes = [],
  keys = [],
  adminId = undefined,
  description = "Client description",
}: {
  consumerId?: TenantId;
  users?: UserId[];
  kind?: ClientKind;
  purposes?: PurposeId[];
  keys?: Key[];
  adminId?: UserId;
  description?: string;
} = {}): Client => ({
  id: generateId(),
  consumerId,
  name: "Test client",
  purposes,
  ...(description ? { description } : {}),
  users,
  kind,
  createdAt: new Date(),
  keys,
  ...(adminId ? { adminId } : {}),
});

export const getMockProducerKeychain = ({
  producerId = generateId<TenantId>(),
}: {
  producerId?: TenantId;
} = {}): ProducerKeychain => ({
  id: generateId(),
  producerId,
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

export const getMockClientJWKKey = (clientId?: ClientId): ClientJWKKey => {
  const key = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;

  const base64Key = Buffer.from(
    key.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");

  return keyToClientJWKKey(
    { ...getMockKey(), encodedPem: base64Key },
    clientId || generateId()
  );
};

export const getMockProducerJWKKey = (
  producerKeychainId?: ProducerKeychainId
): ProducerJWKKey => {
  const key = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;

  const base64Key = Buffer.from(
    key.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");

  return keyToProducerJWKKey(
    { ...getMockKey(), encodedPem: base64Key },
    producerKeychainId || generateId()
  );
};

export const getMockAuthData = (
  organizationId?: TenantId,
  userId?: UserId,
  userRoles?: UserRole[]
): UIAuthData => ({
  systemRole: undefined,
  organizationId: organizationId || generateId(),
  userId: userId || generateId(),
  userRoles: userRoles || [userRole.ADMIN_ROLE],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  selfcareId: generateId(),
  jti: generateId(),
});

export const getMockDelegation = ({
  kind,
  id = generateId<DelegationId>(),
  delegatorId = generateId<TenantId>(),
  delegateId = generateId<TenantId>(),
  eserviceId = generateId<EServiceId>(),
  state = "WaitingForApproval",
  submitterId = generateId<UserId>(),
  activationContract,
  revocationContract,
  rejectionReason,
  updatedAt,
  stamps,
  activationSignedContract,
  revocationSignedContract,
}: {
  kind: DelegationKind;
  id?: DelegationId;
  delegatorId?: TenantId;
  delegateId?: TenantId;
  eserviceId?: EServiceId;
  state?: DelegationState;
  submitterId?: UserId;
  activationContract?: DelegationContractDocument;
  revocationContract?: DelegationContractDocument;
  rejectionReason?: string;
  updatedAt?: Date;
  stamps?: DelegationStamps;
  activationSignedContract?: DelegationSignedContractDocument;
  revocationSignedContract?: DelegationSignedContractDocument;
}): Delegation => {
  const creationTime = new Date();

  return {
    id,
    delegatorId,
    delegateId,
    eserviceId,
    createdAt: creationTime,
    state,
    kind,
    ...(activationContract ? { activationContract } : {}),
    ...(revocationContract ? { revocationContract } : {}),
    ...(rejectionReason ? { rejectionReason } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    stamps: stamps ?? {
      submission: {
        who: submitterId,
        when: creationTime,
      },
    },
    ...(activationSignedContract ? { activationSignedContract } : {}),
    ...(revocationSignedContract ? { revocationSignedContract } : {}),
  };
};

export const getMockDelegationDocument = (
  id?: DelegationContractId
): DelegationContractDocument => ({
  id: id ?? generateId(),
  name: "Test document",
  prettyName: "Test document",
  contentType: "json",
  path: "path",
  createdAt: new Date(),
});

export const getMockDelegationSignedDocument = (
  id?: DelegationContractId
): DelegationSignedContractDocument => ({
  id: id ?? generateId(),
  name: "Test document",
  prettyName: "Test document",
  contentType: "json",
  path: "path",
  createdAt: new Date(),
  signedAt: new Date(),
});

export const getMockTokenGenStatesConsumerClient = (
  tokenGenStatesEntryPK?:
    | TokenGenerationStatesClientKidPurposePK
    | TokenGenerationStatesClientKidPK
): TokenGenerationStatesConsumerClient => {
  const clientId = tokenGenStatesEntryPK
    ? unsafeBrandId<ClientId>(tokenGenStatesEntryPK.split("#")[1])
    : generateId<ClientId>();
  const purposeId = generateId<PurposeId>();
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const descriptorId = generateId<DescriptorId>();
  const agreementId = generateId<AgreementId>();
  const purposeVersionId = generateId<PurposeVersionId>();
  const kid = `kid ${Math.random()}`;

  if (
    !tokenGenStatesEntryPK ||
    TokenGenerationStatesClientKidPurposePK.safeParse(tokenGenStatesEntryPK)
      .success
  ) {
    return {
      PK:
        tokenGenStatesEntryPK ||
        makeTokenGenerationStatesClientKidPurposePK({
          clientId,
          kid,
          purposeId,
        }),
      descriptorState: itemState.active,
      descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
      descriptorVoucherLifespan: 60,
      updatedAt: new Date().toISOString(),
      producerId,
      consumerId,
      agreementId,
      purposeVersionId,
      GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      }),
      clientKind: clientKindTokenGenStates.consumer,
      publicKey: "PEM",
      GSIPK_clientId: clientId,
      GSIPK_clientId_kid: makeGSIPKClientIdKid({ clientId, kid }),
      agreementState: itemState.active,
      GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
        eserviceId,
        descriptorId,
      }),
      GSIPK_purposeId: purposeId,
      purposeState: itemState.active,
      GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
        clientId,
        purposeId,
      }),
    };
  } else {
    return {
      PK: tokenGenStatesEntryPK,
      updatedAt: new Date().toISOString(),
      consumerId,
      clientKind: clientKindTokenGenStates.consumer,
      publicKey: "PEM",
      GSIPK_clientId: clientId,
      GSIPK_clientId_kid: makeGSIPKClientIdKid({ clientId, kid }),
    };
  }
};

export const getMockPlatformStatesAgreementEntry = (
  primaryKey: PlatformStatesAgreementPK,
  agreementId: AgreementId
): PlatformStatesAgreementEntry => ({
  PK: primaryKey,
  state: itemState.inactive,
  version: 1,
  updatedAt: new Date().toISOString(),
  agreementId,
  agreementTimestamp: new Date().toISOString(),
  agreementDescriptorId: generateId<DescriptorId>(),
  producerId: generateId(),
});

export const getMockTokenGenStatesApiClient = (
  tokenGenStatesEntryPK?: TokenGenerationStatesClientKidPK
): TokenGenerationStatesApiClient => {
  const clientId = tokenGenStatesEntryPK
    ? unsafeBrandId<ClientId>(tokenGenStatesEntryPK.split("#")[1])
    : generateId<ClientId>();

  const consumerId = generateId<TenantId>();
  const kid = `kid ${Math.random()}`;

  return {
    PK:
      tokenGenStatesEntryPK ||
      makeTokenGenerationStatesClientKidPK({
        clientId,
        kid,
      }),
    updatedAt: new Date().toISOString(),
    consumerId,
    clientKind: clientKindTokenGenStates.api,
    publicKey: "PEM",
    GSIPK_clientId: clientId,
    GSIPK_clientId_kid: makeGSIPKClientIdKid({ clientId, kid }),
  };
};

export const getMockPlatformStatesClientEntry = (
  pk?: PlatformStatesClientPK
): PlatformStatesClientEntry => ({
  PK: pk || makePlatformStatesClientPK(generateId<ClientId>()),
  version: 0,
  state: "ACTIVE",
  updatedAt: new Date().toISOString(),
  clientKind: "CONSUMER",
  clientConsumerId: generateId<TenantId>(),
  clientPurposesIds: [],
});

export const getMockClientAssertion = async (props?: {
  standardClaimsOverride?: Partial<jose.JWTPayload>;
  customClaims?: { [k: string]: unknown };
  customHeader?: { [k: string]: unknown };
}): Promise<{
  jws: string;
  clientAssertion: {
    payload: jose.JWTPayload;
    header: jose.JWTHeaderParameters;
  };
  publicKeyEncodedPem: string;
}> => {
  const { keySet, publicKeyEncodedPem } = generateKeySet();

  const threeHourLater = new Date();
  threeHourLater.setHours(threeHourLater.getHours() + 3);

  const clientId = generateId<ClientId>();
  const defaultPayload: jose.JWTPayload = {
    iss: clientId,
    sub: clientId,
    aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
    exp: dateToSeconds(threeHourLater),
    jti: generateId(),
    iat: dateToSeconds(new Date()),
  };

  const actualPayload: jose.JWTPayload = {
    ...defaultPayload,
    ...props?.standardClaimsOverride,
    ...props?.customClaims,
  };

  const headers: jose.JWTHeaderParameters = {
    alg: algorithm.RS256,
    kid: "kid",
    ...props?.customHeader,
  };

  const jws = await signJWT({
    payload: actualPayload,
    headers,
    keySet,
  });

  return {
    jws,
    clientAssertion: {
      payload: actualPayload,
      header: headers,
    },
    publicKeyEncodedPem,
  };
};

export const getMockDPoPProof = async (
  props?: {
    customPayload?: { [k: string]: unknown };
    customHeader?: { [k: string]: unknown };
  },
  alg: Algorithm = algorithm.ES256
): Promise<{
  dpopProofJWS: string;
  dpopProofJWT: DPoPProof;
}> => {
  const { keySet, publicKeyEncodedPem } = generateKeySet(alg);

  const payload: DPoPProofPayload = {
    htm: "POST",
    htu: "test/authorization-server/token.oauth2",
    iat: dateToSeconds(new Date()),
    jti: generateId(),
    ...props?.customPayload,
  };

  const cryptoJWK = createJWK({
    pemKeyBase64: publicKeyEncodedPem,
    strictCheck: alg === algorithm.RS256,
  });

  const jwk = match(alg)
    .with(algorithm.ES256, () => JWKKeyES256.parse(cryptoJWK))
    .with(algorithm.RS256, () => JWKKeyRS256.parse(cryptoJWK))
    .exhaustive();

  const header: DPoPProofHeader = {
    typ: "dpop+jwt",
    alg,
    jwk,
    ...props?.customHeader,
  };

  const dpopJWS = await signJWT({
    payload,
    headers: header,
    keySet,
  });

  return {
    dpopProofJWS: dpopJWS,
    dpopProofJWT: {
      payload,
      header,
    },
  };
};

export const getMockDescriptorRejectionReason =
  (): DescriptorRejectionReason => ({
    rejectionReason: "Rejection Reason",
    rejectedAt: new Date(),
  });

export const generateKeySet = (
  alg: Algorithm = algorithm.RS256
): {
  keySet: crypto.KeyPairKeyObjectResult;
  publicKeyEncodedPem: string;
} => {
  const keySet: crypto.KeyPairKeyObjectResult = match(alg)
    .with(algorithm.RS256, () =>
      crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      })
    )
    .with(algorithm.ES256, () =>
      crypto.generateKeyPairSync("ec", {
        namedCurve: "P-256", // This is the curve for ES256
      })
    )
    .exhaustive();

  const pemPublicKey = keySet.publicKey
    .export({
      type: "spki",
      format: "pem",
    })
    .toString();

  const publicKeyEncodedPem = Buffer.from(pemPublicKey).toString("base64");
  return {
    keySet,
    publicKeyEncodedPem,
  };
};

export const signJWT = async ({
  payload,
  headers,
  keySet,
}: {
  payload: jose.JWTPayload;
  headers: jose.JWTHeaderParameters;
  keySet: crypto.KeyPairKeyObjectResult;
}): Promise<string> => {
  const pemPrivateKey = keySet.privateKey.export({
    type: "pkcs8",
    format: "pem",
  });

  const privateKey = crypto.createPrivateKey(pemPrivateKey);
  return await new jose.SignJWT(payload)
    .setProtectedHeader(headers)
    .sign(privateKey);
};

export const addSomeRandomDelegations = async <
  T extends { eserviceId: EServiceId }
>(
  domainObject: T,
  addOneDelegation: (delegation: Delegation) => Promise<void>
): Promise<void> => {
  const states = [delegationState.rejected, delegationState.revoked];
  const kinds = [
    delegationKind.delegatedProducer,
    delegationKind.delegatedConsumer,
  ];

  for (const state of states) {
    for (const kind of kinds) {
      await addOneDelegation(
        getMockDelegation({
          eserviceId: domainObject.eserviceId,
          kind,
          state,
        })
      );
    }
  }
};

export const getMockEServiceTemplateVersion = (
  eserviceTemplateVersionId: EServiceTemplateVersionId = generateId<EServiceTemplateVersionId>(),
  state: EServiceTemplateVersionState = eserviceTemplateVersionState.draft
): EServiceTemplateVersion => ({
  id: eserviceTemplateVersionId,
  version: 1,
  description: "eService template version description",
  createdAt: new Date(),
  attributes: {
    certified: [],
    declared: [],
    verified: [],
  },
  docs: [],
  state,
  voucherLifespan: 60,
  agreementApprovalPolicy: agreementApprovalPolicy.automatic,
});

export const getMockEServiceTemplate = (
  eserviceTemplateId: EServiceTemplateId = generateId<EServiceTemplateId>(),
  creatorId: TenantId = generateId<TenantId>(),
  versions: EServiceTemplateVersion[] = [getMockEServiceTemplateVersion()]
): EServiceTemplate => ({
  id: eserviceTemplateId,
  creatorId,
  name: "eService template name",
  intendedTarget: "eService template intended target",
  description: "eService template description",
  createdAt: new Date(),
  technology: technology.rest,
  versions,
  riskAnalysis: [],
  mode: "Deliver",
  isSignalHubEnabled: true,
});

export const getMockContext = ({
  authData,
  serviceName,
  correlationId,
}: {
  authData?: UIAuthData;
  serviceName?: string;
  correlationId?: CorrelationId;
}): WithLogger<AppContext<UIAuthData>> => ({
  authData: authData || getMockAuthData(),
  serviceName: serviceName || "test",
  correlationId: correlationId || generateId(),
  spanId: generateId(),
  logger: genericLogger,
  requestTimestamp: Date.now(),
});

export const sortBy =
  <T>(getKey: (item: T) => string) =>
  (a: T, b: T): number => {
    const keyA = getKey(a);
    const keyB = getKey(b);

    if (keyA < keyB) {
      return -1;
    }
    if (keyA > keyB) {
      return 1;
    }
    return 0;
  };

export const sortTenant = <T extends Tenant | WithMetadata<Tenant> | undefined>(
  tenant: T
): T => {
  if (tenant === undefined) {
    return tenant;
  } else if ("data" in tenant && "metadata" in tenant) {
    return {
      ...tenant,
      data: sortTenant(tenant.data),
    };
  } else {
    return {
      ...tenant,
      attributes: [...tenant.attributes].sort(sortBy((att) => att.id)),
      features: [...tenant.features].sort(sortBy((feature) => feature.type)),
    };
  }
};

export const sortAgreement = <
  T extends Agreement | WithMetadata<Agreement> | undefined
>(
  agreement: T
): T => {
  if (!agreement) {
    return agreement;
  } else if ("data" in agreement) {
    return {
      ...agreement,
      data: sortAgreement(agreement.data),
    };
  } else {
    return {
      ...agreement,
      verifiedAttributes: agreement.verifiedAttributes
        ? [...agreement.verifiedAttributes].sort(
            sortBy<AgreementAttribute>((attr) => attr.id)
          )
        : [],
      certifiedAttributes: agreement.certifiedAttributes
        ? [...agreement.certifiedAttributes].sort(
            sortBy<AgreementAttribute>((att) => att.id)
          )
        : [],
      declaredAttributes: agreement.declaredAttributes
        ? [...agreement.declaredAttributes].sort(
            sortBy<AgreementAttribute>((att) => att.id)
          )
        : [],
      consumerDocuments: agreement.consumerDocuments
        ? [...agreement.consumerDocuments].sort(
            sortBy<AgreementDocument>((doc) => doc.id)
          )
        : [],
    };
  }
};

export const sortPurpose = <
  T extends Purpose | PurposeV2 | WithMetadata<Purpose> | undefined
>(
  purpose: T
): T => {
  if (!purpose) {
    return purpose;
  } else if ("data" in purpose) {
    return {
      ...purpose,
      data: sortPurpose(purpose.data),
    };
  } else {
    return {
      ...purpose,
      versions: [...purpose.versions].sort(sortBy((version) => version.id)),
      ...(purpose.riskAnalysisForm
        ? {
            riskAnalysisForm: {
              ...purpose.riskAnalysisForm,
              singleAnswers: [...purpose.riskAnalysisForm.singleAnswers].sort(
                sortBy((answer) => answer.key)
              ),
              multiAnswers: [...purpose.riskAnalysisForm.multiAnswers].sort(
                sortBy((answer) => answer.key)
              ),
            },
          }
        : {}),
    };
  }
};

const sortRiskAnalysisTemplateAnswers = <
  T extends
    | RiskAnalysisTemplateSingleAnswer
    | RiskAnalysisTemplateSingleAnswerV2
    | RiskAnalysisTemplateMultiAnswer
    | RiskAnalysisTemplateMultiAnswerV2
>(
  answers: T[]
): T[] =>
  [...answers]
    .map((answer) => ({
      ...answer,
      ...(answer.annotation && {
        annotation: {
          ...answer.annotation,
          docs: [...answer.annotation.docs].sort(sortBy((doc) => doc.id)),
        },
      }),
      ...("suggestedValues" in answer &&
        answer.suggestedValues && {
          suggestedValues: [...answer.suggestedValues].sort(),
        }),
    }))
    .sort(sortBy((a) => a.key));

export const sortPurposeTemplate = <
  T extends
    | PurposeTemplate
    | PurposeTemplateV2
    | WithMetadata<PurposeTemplate>
    | undefined
>(
  purposeTemplate: T
): T => {
  if (!purposeTemplate) {
    return purposeTemplate;
  } else if ("data" in purposeTemplate) {
    return {
      ...purposeTemplate,
      data: sortPurposeTemplate(purposeTemplate.data),
    };
  } else {
    return {
      ...purposeTemplate,
      ...(purposeTemplate.purposeRiskAnalysisForm
        ? {
            purposeRiskAnalysisForm: {
              ...purposeTemplate.purposeRiskAnalysisForm,
              singleAnswers: sortRiskAnalysisTemplateAnswers(
                purposeTemplate.purposeRiskAnalysisForm.singleAnswers.map(
                  (answer) => ({
                    ...answer,
                  })
                )
              ),
              multiAnswers: sortRiskAnalysisTemplateAnswers(
                purposeTemplate.purposeRiskAnalysisForm.multiAnswers.map(
                  (answer) => ({
                    ...answer,
                  })
                )
              ),
            },
          }
        : {}),
    };
  }
};

export const sortClient = <T extends Client | WithMetadata<Client> | undefined>(
  client: T
): T => {
  if (!client) {
    return client;
  } else if ("data" in client) {
    return {
      ...client,
      data: sortClient(client.data),
    };
  } else {
    return {
      ...client,
      purposes: [...client.purposes].sort(),
      users: [...client.users].sort(),
      keys: [...client.keys].sort(sortBy((k) => k.createdAt.toISOString())),
    };
  }
};

export const sortProducerKeychain = <
  T extends ProducerKeychain | WithMetadata<ProducerKeychain> | undefined
>(
  producerKeychain: T
): T => {
  if (!producerKeychain) {
    return producerKeychain;
  } else if ("data" in producerKeychain) {
    return {
      ...producerKeychain,
      data: sortProducerKeychain(producerKeychain.data),
    };
  } else {
    return {
      ...producerKeychain,
      eservices: [...producerKeychain.eservices].sort(),
      users: [...producerKeychain.users].sort(),
      keys: [...producerKeychain.keys].sort(
        sortBy((k) => k.createdAt.toISOString())
      ),
    };
  }
};

export const sortAgreementV2 = <T extends AgreementV2 | undefined>(
  agreement: T
): T => ({
  ...agreement,
  verifiedAttributes: agreement?.verifiedAttributes
    ? [...agreement.verifiedAttributes].sort(
        sortBy<VerifiedAttributeV2>((attr) => attr.id)
      )
    : [],
  certifiedAttributes: agreement?.certifiedAttributes
    ? [...agreement.certifiedAttributes].sort(
        sortBy<CertifiedAttributeV2>((att) => att.id)
      )
    : [],
  declaredAttributes: agreement?.declaredAttributes
    ? [...agreement.declaredAttributes].sort(
        sortBy<DeclaredAttributeV2>((att) => att.id)
      )
    : [],
  consumerDocuments: agreement?.consumerDocuments
    ? [...agreement.consumerDocuments].sort(
        sortBy<AgreementDocumentV2>((doc) => doc.id)
      )
    : [],
});

export const sortAgreements = <
  T extends Agreement | WithMetadata<Agreement> | undefined
>(
  agreements: T[]
): T[] => agreements.map(sortAgreement);

export const sortDescriptor = (descriptor: Descriptor): Descriptor => ({
  ...descriptor,
  // eslint-disable-next-line functional/immutable-data
  docs: descriptor.docs.sort(sortBy((doc) => doc.id)),
  attributes: {
    certified: descriptor.attributes.certified.map((array) =>
      // eslint-disable-next-line functional/immutable-data
      array.sort(sortBy((attr) => attr.id))
    ),
    declared: descriptor.attributes.declared.map((array) =>
      // eslint-disable-next-line functional/immutable-data
      array.sort(sortBy((attr) => attr.id))
    ),
    verified: descriptor.attributes.verified.map((array) =>
      // eslint-disable-next-line functional/immutable-data
      array.sort(sortBy((attr) => attr.id))
    ),
  },
});

export const sortEService = <
  T extends EService | WithMetadata<EService> | undefined
>(
  eservice: T
): T => {
  if (!eservice) {
    return eservice;
  } else if ("data" in eservice) {
    return {
      ...eservice,
      data: sortEService(eservice.data),
    };
  } else {
    return {
      ...eservice,
      descriptors: eservice.descriptors.map(sortDescriptor),
    };
  }
};

export const sortEServices = (eservices: EService[]): EService[] =>
  eservices.map(sortEService);

export const getMockContextInternal = ({
  serviceName,
}: {
  serviceName?: string;
}): WithLogger<AppContext<InternalAuthData>> => ({
  authData: {
    systemRole: systemRole.INTERNAL_ROLE,
    jti: generateId(),
  },
  serviceName: serviceName || "test",
  correlationId: generateId(),
  logger: genericLogger,
  spanId: generateId(),
  requestTimestamp: Date.now(),
});

export const getMockContextMaintenance = ({
  serviceName,
}: {
  serviceName?: string;
}): WithLogger<AppContext<MaintenanceAuthData>> => ({
  authData: {
    systemRole: systemRole.MAINTENANCE_ROLE,
    jti: generateId(),
  },
  serviceName: serviceName || "test",
  correlationId: generateId(),
  logger: genericLogger,
  spanId: generateId(),
  requestTimestamp: Date.now(),
});

export const getMockContextM2M = ({
  organizationId,
  serviceName,
}: {
  organizationId?: TenantId;
  serviceName?: string;
}): WithLogger<AppContext<M2MAuthData>> => ({
  authData: {
    systemRole: systemRole.M2M_ROLE,
    organizationId: organizationId || generateId(),
    clientId: generateId(),
    jti: generateId(),
  },
  serviceName: serviceName || "test",
  correlationId: generateId(),
  spanId: generateId(),
  logger: genericLogger,
  requestTimestamp: Date.now(),
});

export const getMockContextM2MAdmin = ({
  organizationId,
  serviceName,
}: {
  organizationId?: TenantId;
  serviceName?: string;
}): WithLogger<AppContext<M2MAdminAuthData>> => ({
  authData: {
    systemRole: systemRole.M2M_ADMIN_ROLE,
    organizationId: organizationId || generateId(),
    clientId: generateId(),
    userId: generateId(),
    jti: generateId(),
  },
  serviceName: serviceName || "test",
  correlationId: generateId(),
  spanId: generateId(),
  logger: genericLogger,
  requestTimestamp: Date.now(),
});

export const getMockSessionClaims = (
  roles: UserRole[] = [userRole.ADMIN_ROLE]
): UIClaims => ({
  uid: generateId(),
  organization: {
    id: generateId(),
    name: "My Org",
    roles: roles.map((r) => ({ role: r })),
  },
  name: "A generic user",
  family_name: "Family name",
  email: "randomEmailforTest@tester.com",
  "user-roles": roles,
  organizationId: generateId(),
  selfcareId: generateId(),
  externalId: {
    origin: "Internals",
    value: generateId(),
  },
});

export const getMockWithMetadata = <T>(
  data: T,
  version?: number
): WithMetadata<T> => ({
  data,
  metadata: { version: version ?? generateMock(z.number().int()) },
});

export const readFileContent = async (fileName: string): Promise<string> => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templatePath = `../test/resources/${fileName}`;

  const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
  return htmlTemplateBuffer.toString();
};

export function createDummyStub<T>(): T {
  return {} as T;
}

export const getMockNotificationConfig = (): NotificationConfig =>
  Object.keys(NotificationConfig.shape).reduce((acc, key) => {
    // eslint-disable-next-line functional/immutable-data
    acc[key as keyof NotificationConfig] = generateMock(z.boolean());
    return acc;
  }, {} as NotificationConfig);

export const getMockTenantNotificationConfig =
  (): TenantNotificationConfig => ({
    id: generateId(),
    tenantId: generateId(),
    enabled: generateMock(z.boolean()),
    createdAt: generateMock(z.coerce.date()),
    updatedAt: generateMock(z.coerce.date().optional()),
  });

export const getMockUserNotificationConfig = (): UserNotificationConfig => ({
  id: generateId(),
  userId: generateId(),
  tenantId: generateId(),
  inAppNotificationPreference: generateMock(z.boolean()),
  emailNotificationPreference: generateMock(z.boolean()),
  emailDigestPreference: generateMock(z.boolean()),
  inAppConfig: getMockNotificationConfig(),
  emailConfig: getMockNotificationConfig(),
  userRoles: [userRole.ADMIN_ROLE],
  createdAt: generateMock(z.coerce.date()),
  updatedAt: generateMock(z.coerce.date().optional()),
});
