import { containsHyperlink } from "../utils/regexpUtils.js";

export function containsUnexpectedRiskAnalysisHyperlink(
  fieldName: string,
  value: string
): boolean {
  // This field explicitly asks the user for the online privacy policy URL.
  return fieldName !== "policyProvidedOnlineLink" && containsHyperlink(value);
}
