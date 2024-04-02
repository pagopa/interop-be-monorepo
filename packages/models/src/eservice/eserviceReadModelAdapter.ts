/*
  This code adapts Attribute to AttributeReadModel,
  for retro-compatibility with the read model in production:
  the Scala services read/write ISO strings for all date fields.

  After all services will be migrated to TS, we should remove these adapters
  and the corresponding models, as tracked in https://pagopa.atlassian.net/browse/IMN-367
*/

import {
  DocumentReadModel,
  DescriptorReadModel,
  RiskAnalysisReadModel,
  EServiceReadModel,
} from "../read-models/eserviceReadModel.js";
import { RiskAnalysis } from "../risk-analysis/riskAnalysis.js";
import { Document, Descriptor, EService } from "./eservice.js";

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
