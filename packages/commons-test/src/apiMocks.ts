import {
  attributeRegistryApi,
  catalogApi,
  delegationApi,
  agreementApi,
  purposeApi,
  tenantApi,
  authorizationApi,
  eserviceTemplateApi,
} from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { ClientId, algorithm, generateId } from "pagopa-interop-models";
import { z } from "zod";
import { match } from "ts-pattern";
import { getMockClientJWKKey } from "./testUtils.js";

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
    dailyCalls: generateMock(z.number().positive()),
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
  };
}

export function getMockedApiDelegation({
  kind,
  eserviceId,
  delegateId,
  state,
}: {
  kind?: delegationApi.DelegationKind;
  eserviceId?: string;
  delegateId?: string;
  state?: delegationApi.DelegationState;
} = {}): delegationApi.Delegation {
  return {
    kind: kind ?? delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
    id: generateId(),
    eserviceId: eserviceId ?? generateId(),
    delegateId: delegateId ?? generateId(),
    delegatorId: generateId(),
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
}: {
  state?: agreementApi.AgreementState;
  eserviceId?: string;
  descriptorId?: string;
  consumerId?: string;
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
    consumerDocuments: generateMock(z.array(agreementApi.Document)),
    verifiedAttributes: generateMock(z.array(agreementApi.VerifiedAttribute)),
    createdAt: new Date().toISOString(),
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
    externalId: {
      origin: generateMock(z.string()),
      value: generateMock(z.string()),
    },
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

export function getMockedApiEservice({
  descriptors,
}: {
  descriptors?: catalogApi.EServiceDescriptor[];
} = {}): catalogApi.EService {
  return {
    id: generateId(),
    name: generateMock(z.string().length(10)),
    producerId: generateId(),
    description: generateMock(z.string().length(10)),
    technology: generateMock(catalogApi.EServiceTechnology),
    descriptors:
      descriptors ?? generateMock(z.array(catalogApi.EServiceDescriptor)),
    riskAnalysis: generateMock(z.array(catalogApi.EServiceRiskAnalysis)),
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
}: {
  state?: catalogApi.EServiceDescriptorState;
  interfaceDoc?: catalogApi.EServiceDoc;
} = {}): catalogApi.EServiceDescriptor {
  return {
    id: generateId(),
    version: generateMock(z.string()),
    description: generateMock(z.string().length(10)),
    audience: generateMock(z.array(z.string())),
    voucherLifespan: generateMock(z.number().int().min(60).max(86400)),
    dailyCallsPerConsumer: generateMock(z.number().int().gte(1)),
    dailyCallsTotal: generateMock(z.number().int().gte(1)),
    interface: interfaceDoc ?? generateMock(catalogApi.EServiceDoc),
    docs: generateMock(z.array(catalogApi.EServiceDoc)),
    state: state ?? generateMock(catalogApi.EServiceDescriptorState),
    agreementApprovalPolicy: generateMock(catalogApi.AgreementApprovalPolicy),
    serverUrls: generateMock(z.array(z.string())),
    publishedAt: new Date().toISOString(),
    suspendedAt: new Date().toISOString(),
    deprecatedAt: new Date().toISOString(),
    archivedAt: new Date().toISOString(),
    attributes: generateMock(catalogApi.Attributes),
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
}: {
  state?: eserviceTemplateApi.EServiceTemplateVersionState;
} = {}): eserviceTemplateApi.EServiceTemplateVersion {
  return {
    id: generateId(),
    state:
      state ?? generateMock(eserviceTemplateApi.EServiceTemplateVersionState),
    voucherLifespan: generateMock(z.number().positive()),
    version: 0,
    attributes: {
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
