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

import {
  RiskAnalysisId,
  unsafeBrandId,
  EServiceDescriptorV1,
  EServiceDescriptorV2,
  EServiceRiskAnalysisV1,
  EServiceRiskAnalysisV2,
  EServiceV1,
  EServiceV2,
  EServiceLegacy,
  RiskAnalysisLegacy,
  DescriptorLegacy,
  EServiceDocumentV1,
  DocumentLegacy,
  EServiceDocumentV2,
} from "pagopa-interop-models";
import {
  fromDescriptorV1,
  fromDocumentV1,
  fromEServiceV1,
  fromRiskAnalysisV1,
} from "../converterV1.js";
import {
  fromDescriptorV2,
  fromDocumentV2,
  fromEServiceV2,
  fromRiskAnalysisV2,
} from "../converterV2.js";
import { parseDateOrThrow } from "../utils.js";

/* ====================================
             Event V1
==================================== */
export const fromDocumentV1Legacy = (
  doc: EServiceDocumentV1
): DocumentLegacy => {
  const document = fromDocumentV1(doc);
  return {
    ...document,
    uploadDate: document.uploadDate.toISOString(),
  };
};

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
    docs: input.docs.map(fromDocumentV1Legacy),
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
export const fromDocumentV2Legacy = (
  doc: EServiceDocumentV2
): DocumentLegacy => {
  const document = fromDocumentV2(doc);
  return {
    ...document,
    uploadDate: document.uploadDate.toISOString(),
  };
};
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
    docs: input.docs.map(fromDocumentV2Legacy),
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
