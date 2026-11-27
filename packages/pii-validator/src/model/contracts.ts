import { z } from "zod";

import { piiCategories } from "./categories.js";

const DetectionField = z
  .object({
    fieldId: z.string().min(1),
    text: z.string(),
  })
  .strict();

export const DetectionRequest = z
  .object({
    fields: z.array(DetectionField).min(1).max(10),
  })
  .strict()
  .refine(
    ({ fields }) =>
      new Set(fields.map(({ fieldId }) => fieldId)).size === fields.length,
    "Duplicate field ID"
  );
export type DetectionRequest = z.infer<typeof DetectionRequest>;

const DetectionResult = z
  .object({
    fieldId: z.string().min(1),
    detectedCategories: z
      .array(z.enum(piiCategories))
      .refine(
        (categories) => new Set(categories).size === categories.length,
        "Duplicate category"
      ),
  })
  .strict();

export const DetectionResponse = z
  .object({
    results: z.array(DetectionResult),
  })
  .strict();
export type DetectionResponse = z.infer<typeof DetectionResponse>;

export function parseDetectionResponse(
  request: DetectionRequest,
  output: unknown
): DetectionResponse {
  // safeParse keeps raw validation details away from callers and error mappers.
  const parsed = DetectionResponse.safeParse(output);
  if (!parsed.success) throw new Error("Invalid detection response");
  const response = parsed.data;
  if (
    response.results.length !== request.fields.length ||
    response.results.some(
      (result, index) =>
        result.fieldId !== request.fields[index].fieldId ||
        (request.fields[index].text === "" &&
          result.detectedCategories.length > 0)
    )
  ) {
    throw new Error("Invalid detection response");
  }
  return response;
}
