import { z } from "zod";

import { DetectedCategories } from "./categories.js";

export const DetectionRequest = z
  .object({
    text: z.string().min(1),
  })
  .strict();
export type DetectionRequest = z.infer<typeof DetectionRequest>;

export const DetectionResponse = z
  .object({
    detectedCategories: DetectedCategories,
  })
  .strict();
export type DetectionResponse = z.infer<typeof DetectionResponse>;
