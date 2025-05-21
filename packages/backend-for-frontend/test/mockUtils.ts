import { attributeRegistryApi, bffApi } from "pagopa-interop-api-clients";
import {
  AttributeId,
  ClientId,
  DelegationId,
  generateId,
  UserId,
  PurposeId,
  PurposeVersionId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";

export const getMockApiDelegation = (): bffApi.Delegation => ({
  id: generateId<DelegationId>(),
  eservice: generateMock(bffApi.DelegationEService.optional()),
  delegate: generateMock(bffApi.DelegationTenant),
  delegator: generateMock(bffApi.DelegationTenant),
  activationContract: generateMock(bffApi.Document.optional()),
  revocationContract: generateMock(bffApi.Document.optional()),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  state: generateMock(bffApi.DelegationState),
  kind: generateMock(bffApi.DelegationKind),
});

export const getMockApiAttributeSeed = (): bffApi.AttributeSeed => ({
  description: generateMock(z.string()),
  name: generateMock(z.string()),
});

export const getMockApiAttribute = (): bffApi.Attribute =>
  bffApi.Attribute.parse(getMockAttributeRegistryApiAttribute());

export const getMockAttributeRegistryApiAttribute =
  (): attributeRegistryApi.Attribute => ({
    id: generateId<AttributeId>(),
    code: generateMock(z.string().optional()),
    kind: generateMock(bffApi.AttributeKind),
    description: generateMock(z.string()),
    name: generateMock(z.string()),
    creationTime: new Date().toISOString(),
  });

export const getMockApiCompactClient = (): bffApi.CompactClient => ({
  id: generateId<ClientId>(),
  name: generateMock(z.string()),
  hasKeys: generateMock(z.boolean()),
  admin: generateMock(bffApi.CompactUser.optional()),
});

export const getMockApiClient = (): bffApi.Client => ({
  id: generateId<ClientId>(),
  createdAt: new Date().toISOString(),
  consumer: generateMock(bffApi.CompactOrganization),
  admin: generateMock(bffApi.CompactUser.optional()),
  name: generateMock(z.string()),
  purposes: generateMock(z.array(bffApi.ClientPurpose)),
  description: generateMock(z.string()),
  kind: generateMock(bffApi.ClientKind),
});

export const getMockApiPublicKey = (): bffApi.PublicKey => ({
  keyId: generateMock(z.string()),
  name: generateMock(z.string()),
  user: getMockApiCompactUser(),
  createdAt: new Date().toISOString(),
  isOrphan: generateMock(z.boolean()),
});

export const getMockApiCompactUser = (): bffApi.CompactUser => ({
  userId: generateId<UserId>(),
  name: generateMock(z.string()),
  familyName: generateMock(z.string()),
});

export const getMockApiEncodedClientKey = (): bffApi.EncodedClientKey => ({
  key: generateMock(z.string()),
});

export const getMockApiCreatedResource = (): bffApi.CreatedResource => ({
  id: generateId(),
});

export const getMockBffApiPurpose = (): bffApi.Purpose & { id: PurposeId } => ({
  id: generateId(),
  title: generateMock(z.string()),
  description: generateMock(z.string()),
  consumer: generateMock(bffApi.CompactOrganization),
  riskAnalysisForm: generateMock(bffApi.RiskAnalysisForm.optional()),
  eservice: generateMock(bffApi.CompactPurposeEService),
  agreement: generateMock(bffApi.CompactAgreement),
  currentVersion: generateMock(bffApi.PurposeVersion.optional()),
  versions: generateMock(z.array(bffApi.PurposeVersion)),
  clients: generateMock(z.array(bffApi.CompactClient)),
  waitingForApprovalVersion: generateMock(bffApi.PurposeVersion.optional()),
  rejectedVersion: generateMock(bffApi.PurposeVersion.optional()),
  suspendedByConsumer: generateMock(z.boolean().optional()),
  suspendedByProducer: generateMock(z.boolean().optional()),
  isFreeOfCharge: generateMock(z.boolean()),
  freeOfChargeReason: generateMock(z.string().optional()),
  dailyCallsPerConsumer: generateMock(z.number().int()),
  dailyCallsTotal: generateMock(z.number().int()),
  delegation: generateMock(bffApi.DelegationWithCompactTenants.optional()),
});

export const getMockBffApiRiskAnalysisFormConfig =
  (): bffApi.RiskAnalysisFormConfig => ({
    version: generateMock(z.string()),
    questions: generateMock(z.array(bffApi.FormConfigQuestion)),
  });

export const getMockBffApiPurposeUpdateContent =
  (): bffApi.PurposeUpdateContent => ({
    title: generateMock(z.string()),
    description: generateMock(z.string()),
    isFreeOfCharge: generateMock(z.boolean()),
    freeOfChargeReason: generateMock(z.string().optional()),
    dailyCalls: generateMock(z.number().int().min(0)),
  });

export const getMockBffApiPurposeVersionResource = (
  purposeId: PurposeId = generateId(),
  versionId: PurposeVersionId = generateId()
): bffApi.PurposeVersionResource & {
  purposeId: PurposeId;
  versionId: PurposeVersionId;
} => ({
  purposeId,
  versionId,
});

export const getMockPurposeSeed = (): bffApi.PurposeSeed => ({
  eserviceId: generateId(),
  consumerId: generateId(),
  title: generateMock(z.string()),
  description: generateMock(z.string()),
  isFreeOfCharge: generateMock(z.boolean()),
  freeOfChargeReason: generateMock(z.string().optional()),
  dailyCalls: generateMock(z.number().int().min(0)),
});

export const getMockReversePurposeSeed = (): bffApi.PurposeEServiceSeed => ({
  eserviceId: generateId(),
  consumerId: generateId(),
  riskAnalysisId: generateId(),
  title: generateMock(z.string()),
  description: generateMock(z.string()),
  isFreeOfCharge: generateMock(z.boolean()),
  freeOfChargeReason: generateMock(z.string().optional()),
  dailyCalls: generateMock(z.number().int().min(0)),
});
