export const candidatePatterns = {
  // Whole blocks avoid prefix recovery and repeated searches for an at-sign.
  emailCandidate: /[^ \t\n\r/\\]+/u,
  ibanCandidate: /IT[A-Za-z0-9]{25}/u,
  numericCandidate: /(?:IT|\+)?[0-9]+(?: +[0-9]+)*/u,
};

export const numericWordPattern = /[\p{L}\p{M}][\p{L}\p{M}\p{N}_]*/u;

export const emailEdgePunctuation = /^["'()[\]<>,;:!?]$/u;
export const numericSeparators = /^[ \u00a0\-\t\n\r–/\\]$/u;
