import { z } from "zod";

const FISCAL_CODE_LENGTH = 11;

export const RawCsvRow = z.object({
  CODICE_IVASS: z.string(),
  TIPO_ALBO: z.string().optional(),
  DATA_ISCRIZIONE_ALBO_ELENCO: z.string().transform((arg) => new Date(arg)),
  DATA_CANCELLAZIONE_ALBO_ELENCO: z.string().transform((arg) => new Date(arg)),
  DENOMINAZIONE_IMPRESA: z.string(),
  CODICE_FISCALE: z
    .string()
    .transform((s) => s.substring(s.length - FISCAL_CODE_LENGTH))
    .optional(),
  CLASSIFICAZIONE: z.string().optional(),
  INDIRIZZO_SEDE_LEGALE_RAPPRESENTANZA_IN_ITALIA: z.string().optional(),
  INDIRIZZO_DIREZIONE_GENERALE: z.string().optional(),
  INDIRIZZO_CASA_MADRE: z.string().optional(),
  TIPO_LAVORO: z.string().optional(),
  PEC: z.string().optional(),
});

export type RawCsvRow = z.infer<typeof RawCsvRow>;

export const CsvRow = z.object({
  CODICE_IVASS: z.string(),
  DATA_ISCRIZIONE_ALBO_ELENCO: z.date(),
  DATA_CANCELLAZIONE_ALBO_ELENCO: z.date(),
  CODICE_FISCALE: z.string().optional(),
});

export type CsvRow = z.infer<typeof CsvRow>;
