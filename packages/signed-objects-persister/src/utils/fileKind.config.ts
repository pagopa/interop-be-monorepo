import { z } from "zod";
import { config } from "../config/config.js";

export const FILE_KIND_CONFIG = Object.freeze({
  RISK_ANALYSIS_DOCUMENT: {
    bucket: config.signedDocumentsBucket,
    process: "riskAnalysis",
  },
  RISK_ANALYSIS_TEMPLATE_DOCUMENT: {
    bucket: config.signedDocumentsBucket,
    process: "purposeTemplate",
  },
  AGREEMENT_CONTRACT: {
    bucket: config.signedDocumentsBucket,
    process: "agreement",
  },
  DELEGATION_CONTRACT: {
    bucket: config.signedDocumentsBucket,
    process: "delegation",
  },
  VOUCHER_AUDIT: { bucket: config.auditBucket, process: null },
  EVENT_JOURNAL: { bucket: config.eventsBucket, process: null },
});

const FILE_KIND_KEYS = [
  "RISK_ANALYSIS_DOCUMENT",
  "RISK_ANALYSIS_TEMPLATE_DOCUMENT",
  "AGREEMENT_CONTRACT",
  "DELEGATION_CONTRACT",
  "VOUCHER_AUDIT",
  "EVENT_JOURNAL",
] as const;

export const FileKindSchema = z.enum(FILE_KIND_KEYS);

export type FileKind = z.infer<typeof FileKindSchema>;
