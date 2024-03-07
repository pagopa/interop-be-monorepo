/* 
  --- Technical NOTE ---
  ISSUE https://pagopa.atlassian.net/browse/IMN-315
  This code provide a zod schema for the eService model that gurantee 
  retrocompatibility with the previous version of object stored into read model NoSQL DB (DocumentDB).
  The old objects was saved using ISO string for all date fields, meanwhile the new event version will use date type.
  To guarantee the retrocompatibility we need to use the zod schema to provide a model with a ISO date string for all date occurrence, 
  the others fields doesn't need to be changed so we cna use the previous defined decoder functions (eg: fromEServiceV1).
  This solution is temporary and will be removed when all services that consuming read model will be 
  able to parse the model in final format.
*/

import z from "zod";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  RiskAnalysisId,
  TenantId,
  unsafeBrandId,
} from "../brandedIds.js";
import {
  AgreementApprovalPolicy,
  DescriptorState,
  EServiceAttributes,
  EServiceMode,
  RiskAnalysisForm,
  Technology,
} from "../eservice/eservice.js";
import {
  EServiceDescriptorV1,
  EServiceDescriptorV2,
  EServiceRiskAnalysisV1,
  EServiceRiskAnalysisV2,
  EServiceV1,
  EServiceV2,
  fromDescriptorV1,
  fromDescriptorV2,
  fromEServiceV1,
  fromEServiceV2,
  fromRiskAnalysisV1,
  fromRiskAnalysisV2,
  parseDateOrThrow,
} from "../index.js";

export const DocumentLegacy = z.object({
  id: EServiceDocumentId,
  name: z.string(),
  contentType: z.string(),
  prettyName: z.string(),
  path: z.string(),
  checksum: z.string(),
  uploadDate: z.string().datetime(),
});
export type DocumentLegacy = z.infer<typeof DocumentLegacy>;

export const DescriptorLegacy = z.object({
  id: DescriptorId,
  version: z.string(),
  description: z.string().optional(),
  interface: DocumentLegacy.optional(),
  docs: z.array(DocumentLegacy),
  state: DescriptorState,
  audience: z.array(z.string()),
  voucherLifespan: z.number().int(),
  dailyCallsPerConsumer: z.number().int(),
  dailyCallsTotal: z.number().int(),
  agreementApprovalPolicy: AgreementApprovalPolicy.optional(),
  createdAt: z.string().datetime(),
  serverUrls: z.array(z.string()),
  publishedAt: z.string().datetime().optional(),
  suspendedAt: z.string().datetime().optional(),
  deprecatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().optional(),
  attributes: EServiceAttributes,
});
export type DescriptorLegacy = z.infer<typeof DescriptorLegacy>;

export const RiskAnalysisLegacy = z.object({
  id: RiskAnalysisId,
  name: z.string(),
  riskAnalysisForm: RiskAnalysisForm,
  createdAt: z.string().datetime(),
});
export type RiskAnalysisLegacy = z.infer<typeof RiskAnalysisLegacy>;

export const EServiceLegacy = z.object({
  id: EServiceId,
  producerId: TenantId,
  name: z.string(),
  description: z.string(),
  technology: Technology,
  attributes: EServiceAttributes.optional(),
  descriptors: z.array(DescriptorLegacy),
  createdAt: z.string().datetime(),
  riskAnalysis: z.array(RiskAnalysisLegacy),
  mode: EServiceMode,
});
export type EServiceLegacy = z.infer<typeof EServiceLegacy>;

/* ====================================
             Event V1
==================================== */
export const fromDescriptorV1Legacy = (
  input: EServiceDescriptorV1
): DescriptorLegacy => {
  const descriptor = fromDescriptorV1(input);
  return {
    ...descriptor,
    interface: descriptor.interface
      ? {
          ...descriptor.interface,
          uploadDate: descriptor.interface.uploadDate.toISOString(),
        }
      : undefined,
    docs: [
      ...descriptor.docs.map((doc) => ({
        ...doc,
        uploadDate: doc.uploadDate.toISOString(),
      })),
    ],
    createdAt: descriptor.createdAt.toISOString(),
    publishedAt: descriptor.publishedAt
      ? descriptor.publishedAt.toISOString()
      : undefined,
    suspendedAt: descriptor.suspendedAt
      ? descriptor.suspendedAt.toISOString()
      : undefined,
    deprecatedAt: descriptor.deprecatedAt
      ? descriptor.deprecatedAt.toISOString()
      : undefined,
    archivedAt: descriptor.archivedAt
      ? descriptor.archivedAt.toISOString()
      : undefined,
  };
};

export const fromRiskAnalysisV1Legacy = (
  input: EServiceRiskAnalysisV1
): RiskAnalysisLegacy => {
  const riskAnalysis = fromRiskAnalysisV1(input);
  return {
    ...riskAnalysis,
    id: unsafeBrandId<RiskAnalysisId>(riskAnalysis.id),
    createdAt: riskAnalysis.createdAt.toISOString(),
  };
};

export const fromEServiceV1Legacy = (input: EServiceV1): EServiceLegacy => {
  const eservice = fromEServiceV1(input);

  const riskAnalysis: RiskAnalysisLegacy[] = input.riskAnalysis
    .map(fromRiskAnalysisV1)
    .map((rs) => ({
      ...rs,
      id: unsafeBrandId<RiskAnalysisId>(rs.id),
      createdAt: new Date(Number(rs.createdAt)).toISOString(),
    }));

  return {
    ...eservice,
    descriptors: input.descriptors.map(fromDescriptorV1Legacy),
    createdAt: parseDateOrThrow(input.createdAt).toISOString(),
    riskAnalysis,
  };
};

/* ====================================
*             Event V2
==================================== */
export const fromDescriptorV2Legacy = (
  input: EServiceDescriptorV2
): DescriptorLegacy => {
  const descriptor = fromDescriptorV2(input);
  return {
    ...descriptor,
    version: descriptor.version,
    interface: descriptor.interface
      ? {
          ...descriptor.interface,
          uploadDate: descriptor.interface.uploadDate.toISOString(),
        }
      : undefined,
    docs: [
      ...descriptor.docs.map((doc) => ({
        ...doc,
        uploadDate: doc.uploadDate.toISOString(),
      })),
    ],
    createdAt: descriptor.createdAt.toISOString(),
    publishedAt: descriptor.publishedAt
      ? descriptor.publishedAt.toISOString()
      : undefined,
    suspendedAt: descriptor.suspendedAt
      ? descriptor.suspendedAt.toISOString()
      : undefined,
    deprecatedAt: descriptor.deprecatedAt
      ? descriptor.deprecatedAt.toISOString()
      : undefined,
    archivedAt: descriptor.archivedAt
      ? descriptor.archivedAt.toISOString()
      : undefined,
  };
};

export const fromRiskAnalysisV2Legacy = (
  input: EServiceRiskAnalysisV2
): RiskAnalysisLegacy => {
  const riskAnalysis = fromRiskAnalysisV2(input);
  return {
    ...riskAnalysis,
    id: unsafeBrandId<RiskAnalysisId>(riskAnalysis.id),
    createdAt: riskAnalysis.createdAt.toISOString(),
  };
};

export const fromEServiceV2Legacy = (input: EServiceV2): EServiceLegacy => ({
  ...fromEServiceV2(input),
  descriptors: input.descriptors.map(fromDescriptorV2Legacy),
  createdAt: parseDateOrThrow(input.createdAt).toISOString(),
  riskAnalysis: input.riskAnalysis.map(fromRiskAnalysisV2Legacy),
});
