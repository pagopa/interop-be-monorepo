import { z } from "zod";

const piiCategories = [
  "EMAIL_ADDRESS",
  "IT_FISCAL_CODE",
  "IT_VAT_CODE",
  "IBAN_CODE",
  "CREDIT_CARD",
  "PHONE_NUMBER",
  "IT_IDENTITY_CARD",
  "IT_DRIVER_LICENSE",
] as const;

const detectedCategoryShape = Object.fromEntries(
  piiCategories.map((category) => [category, z.boolean()])
) as Record<(typeof piiCategories)[number], z.ZodBoolean>;

export const DetectedCategories = z.object(detectedCategoryShape).strict();
export type DetectedCategories = z.infer<typeof DetectedCategories>;
