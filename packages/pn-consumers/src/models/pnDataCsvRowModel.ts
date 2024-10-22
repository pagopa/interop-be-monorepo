import { z } from "zod";

export const StatoFinalitaMigliore = z.enum([
  "Attivo",
  "Sospeso",
  "In attesa di attivazione",
]);

export const PNDataCSVRow = z.object({
  nome_comune: z.string(),
  stato_finalita_migliore: StatoFinalitaMigliore,
  data_attivazione: z.date().optional(),
  fonte_codice: z.string(),
  codice: z.string(),
  carico_finalita_migliore: z.number(),
});

export type PNDataCSVRow = z.infer<typeof PNDataCSVRow>;
export type StatoFinalitaMigliore = z.infer<typeof StatoFinalitaMigliore>;
