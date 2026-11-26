// Extraction rules
export const candidatePatterns = {
  // Whole blocks avoid prefix recovery and repeated searches for an at-sign.
  emailCandidate: /[^ \t\n\r/\\]+/u,
  alphanumericCandidate: /[\p{L}\p{M}\p{N}]+/u,
  numericCandidate: /(?:IT|\+)?[0-9]+(?: +[0-9]+)*/u,
};

export const numericWordPattern = /[\p{L}\p{M}][\p{L}\p{M}\p{N}_]*/u;

export const emailEdgePunctuation = /^["'()[\]<>,;:!?]$/u;
export const numericSeparators = /^[ \u00a0\-\t\n\r–/\\]$/u;

// Validation rules
export const italianIbanPattern = /^IT[A-Za-z0-9]{25}$/u;

// UCO serial formats: MIT circular 30039, 24 October 2011.
// https://mit.gov.it/normativa/circolare-protocollo-30039-del-24102011
export const italianDriverLicensePatterns = {
  numericSerial: /^U1[0-9]{7}[A-Z]$/u,
  letterPrefixedSerial: /^U1[B-HJ-NPR-Z][0-9]{6}[A-Z]$/u,
};
