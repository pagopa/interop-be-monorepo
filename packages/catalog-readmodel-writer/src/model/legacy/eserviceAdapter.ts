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
  DocumentReadModel,
  Document,
  EService,
  EServiceReadModel,
  Descriptor,
  DescriptorReadModel,
  RiskAnalysis,
  RiskAnalysisReadModel,
} from "pagopa-interop-models";

/* ====================================
             Adapter functions
==================================== */
export const toReadModelDocument = (doc: Document): DocumentReadModel => ({
  ...doc,
  uploadDate: doc.uploadDate.toISOString(),
});

export const toReadModelDescriptor = (
  descriptor: Descriptor
): DescriptorReadModel => ({
  ...descriptor,
  docs: descriptor.docs.map(toReadModelDocument),
  interface: descriptor.interface
    ? toReadModelDocument(descriptor.interface)
    : undefined,
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
});

export const toReadModelRiskAnalysis = (
  riskAnalysis: RiskAnalysis
): RiskAnalysisReadModel => ({
  ...riskAnalysis,
  createdAt: riskAnalysis.createdAt.toISOString(),
});

export const toReadModelEService = (eservice: EService): EServiceReadModel => ({
  ...eservice,
  createdAt: eservice.createdAt.toISOString(),
  riskAnalysis: eservice.riskAnalysis.map((ra) => ({
    ...ra,
    createdAt: ra.createdAt.toISOString(),
  })),
  descriptors: eservice.descriptors.map(toReadModelDescriptor),
});
