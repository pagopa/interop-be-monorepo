import {
  attributeRegistryApi,
  catalogApi,
  delegationApi,
  agreementApi,
  purposeApi,
  tenantApi,
  authorizationApi,
  eserviceTemplateApi,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import {
  ClientId,
  ProducerKeychainId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  algorithm,
  generateId,
} from "pagopa-interop-models";
import { z } from "zod";
import { match } from "ts-pattern";
import {
  getMockClientJWKKey,
  getMockProducerJWKKey,
  randomBoolean,
} from "./testUtils.js";

export const mockAvailableDailyCalls = (): number =>
  generateMock(z.number().min(1).max(1000000000));
const mockOptionalDailyCalls = (): number | undefined =>
  randomBoolean() ? mockAvailableDailyCalls() : undefined;

export function getMockedApiPurposeVersion({
  state,
  riskAnalysis,
}: {
  state?: purposeApi.PurposeVersionState;
  riskAnalysis?: purposeApi.PurposeVersionDocument;
} = {}): purposeApi.PurposeVersion {
  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    dailyCalls: mockAvailableDailyCalls(),
    state: state ?? purposeApi.PurposeVersionState.Enum.DRAFT,
    riskAnalysis,
  };
}

export function getMockedApiPurpose({
  versions,
}: {
  versions?: purposeApi.PurposeVersion[];
} = {}): purposeApi.Purpose {
  return {
    id: generateId(),
    eserviceId: generateId(),
    consumerId: generateId(),
    versions: versions ?? [getMockedApiPurposeVersion()],
    title: generateMock(z.string().length(10)),
    description: generateMock(z.string().length(10)),
    createdAt: new Date().toISOString(),
    isRiskAnalysisValid: true,
    isFreeOfCharge: true,
    freeOfChargeReason: generateMock(z.string()),
    purposeTemplateId: generateMock(z.string().uuid().optional()),
  };
}

export function getMockedApiPurposeTemplate(
  state: purposeTemplateApi.PurposeTemplateState = generateMock(
    purposeTemplateApi.PurposeTemplateState
  )
): purposeTemplateApi.PurposeTemplate {
  return {
    id: generateId(),
    targetDescription: generateMock(z.string().min(10).max(250)),
    targetTenantKind: generateMock(purposeTemplateApi.TenantKind),
    creatorId: generateId(),
    state,
    createdAt: new Date().toISOString(),
    purposeTitle: generateMock(z.string().min(5).max(60)),
    purposeDescription: generateMock(z.string().min(10).max(250)),
    purposeRiskAnalysisForm: generateMock(
      purposeTemplateApi.RiskAnalysisFormTemplate
    ),
    purposeIsFreeOfCharge: randomBoolean(),
    handlesPersonalData: randomBoolean(),
    updatedAt: randomBoolean() ? new Date().toISOString() : undefined,
    purposeFreeOfChargeReason: generateMock(z.string().optional()),
    purposeDailyCalls: mockOptionalDailyCalls(),
  };
}

export function getMockedApiEServiceDescriptorPurposeTemplate(): purposeTemplateApi.EServiceDescriptorPurposeTemplate {
  return {
    purposeTemplateId: generateId(),
    eserviceId: generateId(),
    descriptorId: generateId(),
    createdAt: new Date().toISOString(),
  };
}

export function getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument({
  id = generateId(),
  path = "purposeTemplateAnnotationsPath",
  name = generateMock(z.string()),
}: {
  id: RiskAnalysisTemplateAnswerAnnotationDocumentId;
  path: string;
  name: string;
}): purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument {
  return {
    id,
    name,
    path,
    prettyName: generateMock(z.string()),
    contentType: "application/pdf",
    createdAt: new Date().toISOString(),
    checksum:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  };
}

export function getMockedApiRiskAnalysisTemplateAnnotationDocumentWithAnswerId({
  id = generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>(),
  name = "doc.txt",
  path = `mock/path/${id}/doc.txt`,
  contentType = "text/plain",
  answerId = generateId(),
}: {
  id?: RiskAnalysisTemplateAnswerAnnotationDocumentId;
  name?: string;
  path?: string;
  contentType?: string;
  answerId?: string;
} = {}): purposeTemplateApi.RiskAnalysisTemplateAnnotationDocumentWithAnswerId {
  return {
    answerId,
    document: {
      ...getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument({
        id,
        path,
        name,
      }),
      contentType,
    },
  };
}

export function getMockedApiDelegation({
  kind,
  eserviceId,
  delegateId,
  delegatorId,
  state,
}: {
  kind?: delegationApi.DelegationKind;
  eserviceId?: string;
  delegateId?: string;
  delegatorId?: string;
  state?: delegationApi.DelegationState;
} = {}): delegationApi.Delegation {
  return {
    kind: kind ?? delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
    id: generateId(),
    eserviceId: eserviceId ?? generateId(),
    delegateId: delegateId ?? generateId(),
    delegatorId: delegatorId ?? generateId(),
    createdAt: new Date().toISOString(),
    state: state ?? delegationApi.DelegationState.Values.WAITING_FOR_APPROVAL,
    stamps: {
      submission: {
        who: generateId(),
        when: new Date().toISOString(),
      },
    },
  };
}

export function getMockedApiAgreement({
  state,
  eserviceId,
  descriptorId,
  consumerId,
  contract,
  consumerDocuments,
  stamps,
}: {
  state?: agreementApi.AgreementState;
  eserviceId?: string;
  descriptorId?: string;
  consumerId?: string;
  contract?: agreementApi.Document;
  consumerDocuments?: agreementApi.Document[];
  stamps?: agreementApi.AgreementStamps;
} = {}): agreementApi.Agreement {
  return {
    id: generateId(),
    eserviceId: eserviceId ?? generateId(),
    descriptorId: descriptorId ?? generateId(),
    producerId: generateId(),
    consumerId: consumerId ?? generateId(),
    state: state ?? agreementApi.AgreementState.Values.ACTIVE,
    certifiedAttributes: generateMock(z.array(agreementApi.CertifiedAttribute)),
    declaredAttributes: generateMock(z.array(agreementApi.DeclaredAttribute)),
    consumerDocuments:
      consumerDocuments ?? generateMock(z.array(agreementApi.Document)),
    verifiedAttributes: generateMock(z.array(agreementApi.VerifiedAttribute)),
    createdAt: new Date().toISOString(),
    contract,
    stamps: stamps ?? generateMock(agreementApi.AgreementStamps),
  };
}

export function getMockedApiTenant({
  attributes,
}: {
  attributes?: tenantApi.TenantAttribute[];
} = {}): tenantApi.Tenant {
  return {
    id: generateId(),
    attributes: attributes ?? generateMock(z.array(tenantApi.TenantAttribute)),
    externalId: generateMock(tenantApi.ExternalId),
    name: generateMock(z.string()),
    createdAt: new Date().toISOString(),
    kind: tenantApi.TenantKind.Values.GSP,
    mails: generateMock(z.array(tenantApi.Mail)),
    features: generateMock(z.array(tenantApi.TenantFeature)),
  };
}

export function getMockedApiAttribute({
  kind,
  code,
  name,
  description,
}: {
  kind?: attributeRegistryApi.AttributeKind;
  code?: string;
  name?: string;
  description?: string;
} = {}): attributeRegistryApi.Attribute {
  return {
    id: generateId(),
    name: name ?? generateMock(z.string()),
    description: description ?? generateMock(z.string()),
    creationTime: new Date().toISOString(),
    code: code ?? generateMock(z.string()),
    origin: generateMock(z.string()),
    kind: kind ?? attributeRegistryApi.AttributeKind.Values.CERTIFIED,
  };
}

export function getMockedApiVerifiedTenantAttributeRevoker(
  revokerId: tenantApi.TenantRevoker["id"],
  delegationId?: tenantApi.TenantRevoker["delegationId"]
): tenantApi.TenantRevoker {
  const now = new Date();
  const daysAgo = (min: number, max: number): number =>
    now.getTime() -
    1000 * 60 * 60 * 24 * (Math.floor(Math.random() * (max - min + 1)) + min);
  const daysInFuture = (min: number, max: number): number =>
    now.getTime() +
    1000 * 60 * 60 * 24 * (Math.floor(Math.random() * (max - min + 1)) + min);

  const verificationDate = new Date(daysAgo(20, 60)); // 20-60 days ago
  const revocationDate = new Date(daysAgo(1, 19)); // 1-19 days ago
  const expirationDate = new Date(daysInFuture(10, 40)); // 10-40 days in future
  const extensionDate = new Date(daysInFuture(41, 90)); // 41-90 days in future

  return {
    id: revokerId,
    verificationDate: verificationDate.toISOString(),
    expirationDate: expirationDate.toISOString(),
    extensionDate: extensionDate.toISOString(),
    revocationDate: revocationDate.toISOString(),
    delegationId: delegationId ?? generateId(),
  };
}

export function getMockedApiVerifiedTenantAttributeVerifier(
  verifierId: tenantApi.TenantVerifier["id"],
  delegationId?: tenantApi.TenantVerifier["delegationId"]
): tenantApi.TenantVerifier {
  const now = new Date();
  const daysAgo = (min: number, max: number): number =>
    now.getTime() -
    1000 * 60 * 60 * 24 * (Math.floor(Math.random() * (max - min + 1)) + min);
  const daysInFuture = (min: number, max: number): number =>
    now.getTime() +
    1000 * 60 * 60 * 24 * (Math.floor(Math.random() * (max - min + 1)) + min);

  const verificationDate = new Date(daysAgo(20, 60)); // 20-60 days ago
  const expirationDate = new Date(daysInFuture(10, 40)); // 10-40 days in future
  const extensionDate = new Date(daysInFuture(41, 90)); // 41-90 days in future

  return {
    id: verifierId,
    verificationDate: verificationDate.toISOString(),
    expirationDate: expirationDate.toISOString(),
    extensionDate: extensionDate.toISOString(),
    delegationId: delegationId ?? generateId(),
  };
}

export function getMockedApiConsumerFullClient({
  kind: paramKind,
  purposes = [],
}: {
  kind?: authorizationApi.ClientKind;
  purposes?: string[];
} = {}): authorizationApi.FullClient {
  const kind = paramKind ?? authorizationApi.ClientKind.Values.CONSUMER;
  return {
    visibility: authorizationApi.Visibility.Enum.FULL,
    kind: kind ?? authorizationApi.ClientKind.Values.CONSUMER,
    id: generateId(),
    name: generateMock(z.string()),
    description: generateMock(z.string()),
    createdAt: new Date().toISOString(),
    consumerId: generateId(),
    purposes: match(kind)
      .with(
        authorizationApi.ClientKind.Values.CONSUMER,
        () => purposes ?? [generateId(), generateId()]
      )
      .with(authorizationApi.ClientKind.Values.API, () => [])
      .exhaustive(),
    users: [generateId(), generateId()],
    adminId: match(kind)
      .with(authorizationApi.ClientKind.Values.CONSUMER, () => undefined)
      .with(authorizationApi.ClientKind.Values.API, () => generateId())
      .exhaustive(),
  } satisfies authorizationApi.Client;
}

export function getMockedApiConsumerPartialClient({
  kind: paramKind,
}: {
  kind?: authorizationApi.ClientKind;
} = {}): authorizationApi.PartialClient {
  const kind = paramKind ?? authorizationApi.ClientKind.Values.CONSUMER;
  return {
    visibility: authorizationApi.Visibility.Enum.PARTIAL,
    id: generateId(),
    consumerId: generateId(),
    kind: kind ?? authorizationApi.ClientKind.Values.CONSUMER,
  } satisfies authorizationApi.PartialClient;
}

export function getMockedApiFullProducerKeychain({
  eservices = [],
}: {
  eservices?: string[];
} = {}): authorizationApi.FullProducerKeychain {
  return {
    visibility: authorizationApi.Visibility.Enum.FULL,
    id: generateId(),
    name: generateMock(z.string()),
    description: generateMock(z.string()),
    createdAt: new Date().toISOString(),
    producerId: generateId(),
    eservices: eservices ?? [generateId(), generateId()],
    users: [generateId(), generateId()],
    keys: generateMock(z.array(authorizationApi.Key)),
  };
}

export function getMockedApiPartialProducerKeychain(): authorizationApi.PartialProducerKeychain {
  return {
    visibility: authorizationApi.Visibility.Enum.PARTIAL,
    id: generateId(),
    producerId: generateId(),
  };
}

export function getMockedApiEservice({
  descriptors,
  technology,
}: {
  descriptors?: catalogApi.EServiceDescriptor[];
  technology?: catalogApi.EServiceTechnology;
} = {}): catalogApi.EService {
  return {
    id: generateId(),
    name: generateMock(z.string().length(10)),
    producerId: generateId(),
    description: generateMock(z.string().length(10)),
    technology: technology ?? generateMock(catalogApi.EServiceTechnology),
    descriptors:
      descriptors ?? generateMock(z.array(catalogApi.EServiceDescriptor)),
    riskAnalysis: generateMock(z.array(catalogApi.EServiceRiskAnalysis).min(1)),
    mode: generateMock(catalogApi.EServiceMode),
    isSignalHubEnabled: generateMock(z.boolean()),
    isConsumerDelegable: generateMock(z.boolean()),
    isClientAccessDelegable: generateMock(z.boolean()),
    templateId: generateId(),
  };
}

export function getMockedApiEserviceDescriptor({
  state,
  interfaceDoc,
  attributes,
}: {
  state?: catalogApi.EServiceDescriptorState;
  interfaceDoc?: catalogApi.EServiceDoc;
  attributes?: catalogApi.Attributes;
} = {}): catalogApi.EServiceDescriptor {
  return {
    id: generateId(),
    version: generateMock(z.string()),
    description: generateMock(z.string().length(10)),
    audience: generateMock(z.array(z.string())),
    voucherLifespan: generateMock(z.number().int().min(60).max(86400)),
    dailyCallsPerConsumer: mockAvailableDailyCalls(),
    dailyCallsTotal: mockAvailableDailyCalls(),
    interface: interfaceDoc ?? generateMock(catalogApi.EServiceDoc),
    docs: generateMock(z.array(catalogApi.EServiceDoc)),
    state: state ?? generateMock(catalogApi.EServiceDescriptorState),
    agreementApprovalPolicy: generateMock(catalogApi.AgreementApprovalPolicy),
    serverUrls: generateMock(z.array(z.string())),
    publishedAt: new Date().toISOString(),
    suspendedAt: new Date().toISOString(),
    deprecatedAt: new Date().toISOString(),
    archivedAt: new Date().toISOString(),
    attributes: attributes ?? generateMock(catalogApi.Attributes),
    rejectionReasons: generateMock(z.array(catalogApi.RejectionReason)),
    templateVersionRef: generateMock(catalogApi.EServiceTemplateVersionRef),
  };
}

export function getMockedApiEServiceTemplate({
  versions,
}: {
  versions?: eserviceTemplateApi.EServiceTemplateVersion[];
} = {}): eserviceTemplateApi.EServiceTemplate {
  return {
    id: generateId(),
    creatorId: generateId(),
    description: generateMock(z.string().length(10)),
    intendedTarget: generateMock(z.string().length(10)),
    mode: generateMock(eserviceTemplateApi.EServiceMode),
    name: generateMock(z.string().length(10)),
    technology: generateMock(eserviceTemplateApi.EServiceTechnology),
    versions: versions ?? [getMockedApiEserviceTemplateVersion()],
    isSignalHubEnabled: generateMock(z.boolean().optional()),
    riskAnalysis: [
      {
        ...getMockedApiRiskAnalysis(),
        tenantKind: generateMock(eserviceTemplateApi.TenantKind),
      },
    ],
    personalData: generateMock(z.boolean().optional()),
  };
}

export function getMockedApiRiskAnalysis(): catalogApi.EServiceRiskAnalysis {
  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    name: generateMock(z.string().length(10)),
    riskAnalysisForm: {
      id: generateId(),
      multiAnswers: [
        {
          id: generateId(),
          key: generateMock(z.string()),
          values: generateMock(z.array(z.string())),
        },
      ],
      singleAnswers: [
        {
          id: generateId(),
          key: generateMock(z.string()),
          value: generateMock(z.string()),
        },
      ],
      version: "0",
    },
  };
}

export function getMockedApiEserviceTemplateVersion({
  state,
  attributes,
}: {
  state?: eserviceTemplateApi.EServiceTemplateVersionState;
  attributes?: eserviceTemplateApi.Attributes;
} = {}): eserviceTemplateApi.EServiceTemplateVersion {
  return {
    id: generateId(),
    state:
      state ?? generateMock(eserviceTemplateApi.EServiceTemplateVersionState),
    voucherLifespan: generateMock(z.number().positive()),
    version: 0,
    attributes: attributes ?? {
      certified: [[getMockedApiEServiceAttribute()]],
      declared: [[getMockedApiEServiceAttribute()]],
      verified: [[getMockedApiEServiceAttribute()]],
    },
    docs: [],
  };
}

export function getMockedApiEServiceAttribute(): catalogApi.Attribute {
  return {
    id: generateId(),
    explicitAttributeVerification: generateMock(z.boolean()),
  };
}

export function getMockedApiCertifiedTenantAttribute({
  revoked = false,
}: {
  revoked?: boolean;
} = {}): tenantApi.CertifiedTenantAttribute {
  return {
    id: generateId(),
    assignmentTimestamp: new Date().toISOString(),
    revocationTimestamp: revoked ? new Date().toISOString() : undefined,
  };
}

export function getMockedApiVerifiedTenantAttribute(): tenantApi.VerifiedTenantAttribute {
  return {
    id: generateId(),
    assignmentTimestamp: new Date().toISOString(),
    verifiedBy: generateMock(z.array(tenantApi.TenantVerifier)),
    revokedBy: generateMock(z.array(tenantApi.TenantRevoker)),
  };
}

export function getMockedApiDeclaredTenantAttribute({
  revoked = false,
}: {
  revoked?: boolean;
} = {}): tenantApi.DeclaredTenantAttribute {
  return {
    id: generateId(),
    assignmentTimestamp: new Date().toISOString(),
    revocationTimestamp: revoked ? new Date().toISOString() : undefined,
    delegationId: generateId(),
  };
}

export function getMockedApiAgreementDocument({
  id = generateId(),
  name = "doc.txt",
  path = `mock/path/${id}/doc.txt`,
  contentType = "text/plain",
}: {
  id?: string;
  name?: string;
  path?: string;
  contentType?: string;
} = {}): agreementApi.Document {
  return {
    id,
    name,
    contentType,
    prettyName: "Interface Document",
    path,
    createdAt: new Date().toISOString(),
  };
}

export function getMockedApiEserviceDoc({
  id = generateId(),
  name = "doc.txt",
  path = `mock/path/${id}/doc.txt`,
  contentType = "text/plain",
}: {
  id?: string;
  name?: string;
  path?: string;
  contentType?: string;
} = {}): catalogApi.EServiceDoc {
  return {
    id,
    name,
    contentType,
    prettyName: "Interface Document",
    path,
    checksum: "mock-checksum",
    uploadDate: new Date().toISOString(),
    contacts: generateMock(catalogApi.DescriptorInterfaceContacts),
  };
}

export function getMockedApiClientJWK({
  clientId = generateId<ClientId>(),
}: {
  clientId?: ClientId;
} = {}): authorizationApi.ClientJWK {
  const jwk = getMockClientJWKKey(clientId);
  return {
    jwk,
    clientId,
  };
}

export function getMockedApiProducerJWK({
  producerKeychainId = generateId<ProducerKeychainId>(),
}: {
  producerKeychainId?: ProducerKeychainId;
} = {}): authorizationApi.ProducerJWK {
  const jwk = getMockProducerJWKKey(producerKeychainId);
  return {
    jwk,
    producerKeychainId,
  };
}

export function getMockedApiKey({
  kid = generateId(),
}: {
  kid?: string;
} = {}): authorizationApi.Key {
  return {
    kid,
    name: generateMock(z.string().length(10)),
    createdAt: new Date().toISOString(),
    use: authorizationApi.KeyUse.Values.SIG,
    userId: generateId(),
    encodedPem: generateMock(z.string().length(50)),
    algorithm: algorithm.RS256,
  };
}
