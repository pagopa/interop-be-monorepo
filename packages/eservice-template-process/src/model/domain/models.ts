import { z } from "zod";

export const CompactOrganization = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type CompactOrganization = z.infer<typeof CompactOrganization>;
