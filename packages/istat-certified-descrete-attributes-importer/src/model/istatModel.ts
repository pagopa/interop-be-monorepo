import { z } from "zod";

export const IstatCsvRow = z.object({
  "Codice comune": z.string(),
  Comune: z.string(),
  Età: z.coerce.number(),
  Totale: z.coerce.number(),
});

export type IstatCsvRow = z.infer<typeof IstatCsvRow>;

export type JobStats = {
  processed: number;
  created: number;
  errors: number;
};
