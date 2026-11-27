import { piiCategories } from "../model/categories.js";
import {
  Candidate,
  CandidateExtractor,
  extractEmailCandidates,
  extractAlphanumericCandidates,
  extractNumericCandidates,
} from "./candidateExtractors.js";
import {
  isCardCandidate,
  isCieCandidate,
  isItalianDriverLicenseCandidate,
  isEmailCandidate,
  isIbanCandidate,
  isPhoneCandidate,
  isVatCandidate,
} from "./categoryValidators.js";

type Category = (typeof piiCategories)[number];
type CategoryValidator = Readonly<{
  category: Category;
  check: (candidate: Candidate, source: string) => boolean;
}>;

type RecognitionFamily = Readonly<{
  extract: CandidateExtractor;
  validators: readonly CategoryValidator[];
}>;

const recognitionFamilies: readonly RecognitionFamily[] = [
  {
    extract: extractEmailCandidates,
    validators: [{ category: "EMAIL_ADDRESS", check: isEmailCandidate }],
  },
  {
    extract: extractNumericCandidates,
    validators: [
      { category: "IT_VAT_CODE", check: isVatCandidate },
      { category: "CREDIT_CARD", check: isCardCandidate },
      { category: "IT_PHONE_NUMBER", check: isPhoneCandidate },
    ],
  },
  {
    extract: extractAlphanumericCandidates,
    validators: [
      { category: "IT_IBAN_CODE", check: isIbanCandidate },
      { category: "IT_CIE", check: isCieCandidate },
      { category: "IT_DRIVER_LICENSE", check: isItalianDriverLicenseCandidate },
    ],
  },
];

export function detectCategories(
  text: string,
  families: readonly RecognitionFamily[] = recognitionFamilies
): Category[] {
  const detected = new Set<Category>();
  try {
    for (const family of families) {
      // Invocation, lazy iteration and category checks share the privacy boundary.
      for (const candidate of family.extract(text)) {
        for (const { category, check } of family.validators) {
          if (!detected.has(category) && check(candidate, text)) {
            detected.add(category);
          }
        }
      }
    }
    return piiCategories.filter((category) => detected.has(category));
  } catch {
    // Dependency errors may contain source text, stacks and nested causes.
    throw new Error("PII recognition failed");
  }
}
