import {
  PurposeReadModel,
  PurposeVersionDocumentReadModel,
  PurposeVersionReadModel,
} from "../read-models/purposeReadModel.js";
import { Purpose, PurposeVersion, PurposeVersionDocument } from "./purpose.js";

export const toReadModelPurposeVersionDocument = (
  purposeVersionDocument: PurposeVersionDocument
): PurposeVersionDocumentReadModel => ({
  ...purposeVersionDocument,
  createdAt: purposeVersionDocument.createdAt.toISOString(),
});

export const toReadModelPurposeVersion = (
  purposeVersion: PurposeVersion
): PurposeVersionReadModel => ({
  ...purposeVersion,
  createdAt: purposeVersion.createdAt.toISOString(),
  updatedAt: purposeVersion.updatedAt?.toISOString(),
  firstActivationAt: purposeVersion.firstActivationAt?.toISOString(),
  suspendedAt: purposeVersion.suspendedAt?.toISOString(),
  riskAnalysis: purposeVersion.riskAnalysis
    ? toReadModelPurposeVersionDocument(purposeVersion.riskAnalysis)
    : undefined,
});

export const toReadModelPurpose = (purpose: Purpose): PurposeReadModel => ({
  ...purpose,
  createdAt: purpose.createdAt.toISOString(),
  updatedAt: purpose.updatedAt?.toISOString(),
  versions: purpose.versions.map(toReadModelPurposeVersion),
});
