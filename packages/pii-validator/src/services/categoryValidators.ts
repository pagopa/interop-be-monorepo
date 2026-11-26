import validator from "validator";

import { Candidate } from "./candidateExtractors.js";
import {
  italianDriverLicensePatterns,
  italianIbanPattern,
} from "./regexRules.js";

export function isCieCandidate(candidate: Candidate): boolean {
  return validator.isIdentityCard(candidate.text, "IT");
}

export function isItalianDriverLicenseCandidate(candidate: Candidate): boolean {
  return (
    candidate.text.length === 10 &&
    Object.values(italianDriverLicensePatterns).some((pattern) =>
      pattern.test(candidate.text)
    )
  );
}

export function isEmailCandidate(candidate: Candidate): boolean {
  return validator.isEmail(candidate.text);
}

export function isVatCandidate(candidate: Candidate): boolean {
  return validator.isVAT(candidate.text.replaceAll(" ", ""), "IT");
}

export function isCardCandidate(candidate: Candidate): boolean {
  return validator.isCreditCard(candidate.text);
}

export function isIbanCandidate(candidate: Candidate): boolean {
  return (
    candidate.text.length === 27 &&
    italianIbanPattern.test(candidate.text) &&
    validator.isIBAN(candidate.text)
  );
}

// This is contextual phone policy, not a numeric-family boundary: a short
// punctuation-separated numeric prefix must not recover a valid bare suffix.
function hasMalformedPhonePrefix(source: string, start: number): boolean {
  if (source[start] === "+") return false;
  let before = start;
  while (before > 0 && !validator.isAlphanumeric(source[before - 1], "en-US"))
    before--;
  if (
    before < start &&
    before > 0 &&
    validator.isNumeric(source[before - 1], { no_symbols: true })
  ) {
    let priorStart = before;
    while (
      priorStart > 0 &&
      validator.isNumeric(source[priorStart - 1], { no_symbols: true })
    )
      priorStart--;
    return before - priorStart <= 3;
  }
  return false;
}

export function isPhoneCandidate(
  candidate: Candidate,
  source: string
): boolean {
  return (
    !hasMalformedPhonePrefix(source, candidate.start) &&
    validator.isMobilePhone(candidate.text.replaceAll(" ", ""), "it-IT")
  );
}
