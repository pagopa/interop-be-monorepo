import { z } from "zod";

export const InstitutionAttribute = z.object({
  origin: z.string(),
  code: z.string(),
  description: z.string(),
});

export const Institution = z.object({
  id: z.string().uuid(),
  externalId: z.string(),
  originId: z.string(),
  description: z.string(),
  digitalAddress: z.string(),
  address: z.string(),
  zipCode: z.string(),
  taxCode: z.string(),
  origin: z.string(),
  institutionType: z.string().optional(),
  attributes: z.array(InstitutionAttribute),
});

export type Institution = z.infer<typeof Institution>;
