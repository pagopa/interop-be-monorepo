import { z } from "zod";

const SubUnitType = z.enum(["AOO", "UO"]);
type SubUnitType = z.infer<typeof SubUnitType>;

const InstitutionEvent = z.object({
  description: z.string().trim().min(1),
  origin: z.string().trim().min(1),
  originId: z.string().trim().min(1),
  taxCode: z.string().trim().min(1).nullish(),
  subUnitCode: z.string().optional().nullish(), // AOO/UO ID
  subUnitType: SubUnitType.optional().nullish(),
  digitalAddress: z.string().trim().min(1),
  institutionType: z.string().trim().min(1),
});
type InstitutionEvent = z.infer<typeof InstitutionEvent>;

export const InstitutionEventPayload = z.object({
  id: z.string(),
  institutionId: z.string().trim().min(1), // Selfcare ID
  product: z.string().trim().min(1),
  onboardingTokenId: z.string(),
  institution: InstitutionEvent,
  createdAt: z.string(),
});
export type InstitutionEventPayload = z.infer<typeof InstitutionEventPayload>;
