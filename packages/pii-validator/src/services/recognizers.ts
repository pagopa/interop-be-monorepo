import validator from "validator";

import { piiCategories } from "../model/categories.js";
import { candidateSpans, CandidateSpan } from "./candidateSpans.js";

function recognize(
  text: string,
  spans: Iterable<CandidateSpan>,
  check: (candidate: string) => boolean
): boolean {
  try {
    for (const [start, end] of spans) {
      if (check(text.slice(start, end))) return true;
    }
    return false;
  } catch {
    // Checker errors may embed the candidate, even in nested causes.
    throw new Error("PII recognition failed");
  }
}

const strategies: Partial<
  Record<(typeof piiCategories)[number], (text: string) => boolean>
> = {
  EMAIL_ADDRESS: (text) =>
    recognize(text, candidateSpans.email(text), (candidate) =>
      validator.isEmail(candidate)
    ),
  IT_VAT_CODE: (text) =>
    recognize(text, candidateSpans.vat(text), (candidate) =>
      validator.isVAT(candidate, "IT")
    ),
  IBAN_CODE: (text) =>
    recognize(text, candidateSpans.iban(text), (candidate) =>
      validator.isIBAN(candidate)
    ),
  CREDIT_CARD: (text) =>
    recognize(text, candidateSpans.cards(text), (candidate) =>
      validator.isCreditCard(candidate)
    ),
  PHONE_NUMBER: (text) =>
    recognize(text, candidateSpans.phones(text), (candidate) =>
      validator.isMobilePhone(candidate, "it-IT")
    ),
  IT_DRIVER_LICENSE: (text) =>
    recognize(text, candidateSpans.licenses(text), () => true),
};

export function detectCategories(
  text: string
): (typeof piiCategories)[number][] {
  return piiCategories.filter(
    (category) => strategies[category]?.(text) ?? false
  );
}
