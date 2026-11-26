import { piiValidatorApi } from "pagopa-interop-api-clients";

export type DetectPii = (
  request: piiValidatorApi.DetectionRequest
) => Promise<unknown>;

// This capability is deliberately not wired into the catalog-process app yet.
export async function assertDescriptionHasNoPii(
  description: string,
  detectPii: DetectPii
): Promise<void> {
  const fieldId = "description";
  let rawResponse: unknown;
  try {
    rawResponse = await detectPii({ fields: [{ fieldId, text: description }] });
  } catch {
    throw new Error("PII detection unavailable");
  }
  const response = piiValidatorApi.DetectionResponse.safeParse(rawResponse);
  if (
    !response.success ||
    response.data.results.length !== 1 ||
    response.data.results[0].fieldId !== fieldId ||
    (description === "" &&
      response.data.results[0].detectedCategories.length > 0) ||
    new Set(response.data.results[0].detectedCategories).size !==
      response.data.results[0].detectedCategories.length
  ) {
    throw new Error("PII detection unavailable");
  }
  if (response.data.results[0].detectedCategories.length > 0) {
    throw new Error("PII detected in description");
  }
}
