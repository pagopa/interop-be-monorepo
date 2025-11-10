import { config } from "../config/config.js";

export const FILE_KIND_CONFIG = Object.freeze({
  RISK_ANALYSIS_DOCUMENT: {
    bucket: config.signedDocumentsBucket,
    process: "riskAnalysis",
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
