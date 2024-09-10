import { z } from "zod";

const Row = z.object({
  codiceFiscaleGestore: z.string().min(1),
  denominazioneGestore: z.string().min(1),
  PEC: z.string().min(1),
  ANAC_incaricato: z
    .string()
    .transform((value) => value.toUpperCase() === "TRUE"),
  ANAC_abilitato: z
    .string()
    .transform((value) => value.toUpperCase() === "TRUE"),
  ANAC_in_convalida: z
    .string()
    .transform((value) => value.toUpperCase() === "TRUE"),
});

export const NonPaRow = Row.transform((value) => ({
  cf_gestore: value.codiceFiscaleGestore,
  denominazione: value.denominazioneGestore,
  domicilio_digitale: value.PEC,
  anac_incaricato: value.ANAC_incaricato,
  anac_abilitato: value.ANAC_abilitato,
  anac_in_convalida: value.ANAC_in_convalida,
}));

export type NonPaRow = z.infer<typeof NonPaRow>;

export const PaRow = Row.extend({
  codiceIPA: z.string().min(1),
}).transform((value) => ({
  cf_gestore: value.codiceFiscaleGestore,
  denominazione: value.denominazioneGestore,
  domicilio_digitale: value.PEC,
  codice_ipa: value.codiceIPA,
  anac_incaricato: value.ANAC_incaricato,
  anac_abilitato: value.ANAC_abilitato,
  anac_in_convalida: value.ANAC_in_convalida,
}));

export type PaRow = z.infer<typeof PaRow>;

export const CsvRow = PaRow.or(NonPaRow);

export type CsvRow = z.infer<typeof CsvRow>;
