/*
  --- Technical NOTE ---
  ISSUE https://pagopa.atlassian.net/browse/IMN-315
	  This code adapts EService to EServiceReadModel, which guarantees
	  retro compatibility with the objects stored in the old read model NoSQL DB (DocumentDB).
	  The old objects were saved using an ISO string for all date fields: we need to convert all dates to ISO date strings.
	  This solution is temporary and will be removed after all services will be migrated.
*/

import {
  DocumentReadModel,
  DescriptorReadModel,
  RiskAnalysisReadModel,
  EServiceReadModel,
} from "../read-models/eserviceReadModel.js";
import { RiskAnalysis } from "../risk-analysis/riskAnalysis.js";
import { Document, Descriptor, EService } from "./eservice.js";

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
