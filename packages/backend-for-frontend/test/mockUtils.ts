import { bffApi } from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { PurposeId, PurposeVersionId, generateId } from "pagopa-interop-models";

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

export const getMockBffApiPrivacyNotice = (): bffApi.PrivacyNotice => ({
  id: generateId(),
  userId: generateId(),
  consentType: generateMock(bffApi.ConsentType),
  firstAccept: generateMock(z.boolean()),
  isUpdated: generateMock(z.boolean()),
  latestVersionId: generateId(),
});

export const getMockBffApiCompactUser = (): bffApi.CompactUser => ({
  userId: generateId(),
  name: generateMock(z.string()),
  familyName: generateMock(z.string()),
});

export const getMockBffApiPublicKey = (): bffApi.PublicKey => ({
  keyId: generateMock(z.string()),
  name: generateMock(z.string()),
  user: getMockBffApiCompactUser(),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  isOrphan: generateMock(z.boolean()),
});

export const getMockBffApiProducerKeychain = (): bffApi.ProducerKeychain => ({
  id: generateId(),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  producer: generateMock(bffApi.CompactOrganization),
  name: generateMock(z.string()),
  eservices: generateMock(z.array(bffApi.CompactEService)),
  description: generateMock(z.string()),
});

export const getMockBffApiCompactProducerKeychain =
  (): bffApi.CompactProducerKeychain => ({
    id: generateId(),
    name: generateMock(z.string()),
    hasKeys: generateMock(z.boolean()),
  });
