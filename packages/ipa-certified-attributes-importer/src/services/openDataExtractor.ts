/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { z } from "zod";
import { match } from "ts-pattern";
import { config } from "../config/config.js";

type Classification = "Agency" | "AOO" | "UO";

type InstitutionKind = "Agency" | "AOO" | "UO";

type Institution = {
  id: string;
  originId: string;
  taxCode: string;
  category: string;
  description: string;
  digitalAddress: string;
  address: string;
  zipCode: string;
  origin: string;
  kind: string;
  classification: Classification;
};

const fields_name = [
  "Codice_IPA",
  "Denominazione_ente",
  "Denominazione_aoo",
  "Descrizione_uo",
  "Codice_fiscale_ente",
  "Codice_Categoria",
  "Mail1",
  "Indirizzo",
  "CAP",
  "Tipologia",
  "Codice_uni_aoo",
  "Codice_uni_uo",
] as const;
type FieldName = (typeof fields_name)[number];

function fieldExtractor(
  record: unknown[],
  fields: Map<string, number>
): <T>(field_name: FieldName, decoder: z.ZodSchema<T>) => T | undefined {
  return (fields_name, decoder) => {
    const valueIndex = fields.get(fields_name);
    if (!valueIndex) {
      return undefined;
    }

    const value = decoder.safeParse(record[valueIndex]);
    if (!value.success) {
      return undefined;
    }

    return value.data;
  };
}

export async function extractInstitutionsData(
  url: string,
  institutionKind: InstitutionKind,
  institutionsDetails: Map<string, { category: string; kind: string }>
): Promise<Institution[]> {
  const response = await axios.get(url);

  const fields: Map<string, number> = new Map(
    (response.data.fields as Array<{ id: string }>)
      .map<[string, number]>((f, index) => [f.id, index])
      .filter(([f, _]) => (fields_name as readonly string[]).includes(f))
  );

  return (response.data.records as Array<any>).reduce(
    (accumulator, record: any[]) => {
      const extractor = fieldExtractor(record, fields);

      const taxCode = extractor("Codice_fiscale_ente", z.string());
      if (!taxCode) {
        return accumulator;
      }

      const originId = extractor(
        match<InstitutionKind, FieldName>(institutionKind)
          .with("Agency", () => "Codice_IPA")
          .with("AOO", () => "Codice_uni_aoo")
          .with("UO", () => "Codice_uni_uo")
          .exhaustive(),
        z.string()
      );
      if (!originId) {
        return accumulator;
      }

      const category = match(institutionKind)
        .with("Agency", () => extractor("Codice_Categoria", z.string()))
        .otherwise(() => {
          const originId = extractor("Codice_IPA", z.string());
          if (!originId) {
            return undefined;
          }
          return institutionsDetails.get(originId)?.category;
        });
      if (!category) {
        return accumulator;
      }

      const description = match(institutionKind)
        .with("Agency", () => extractor("Denominazione_ente", z.string()))
        .with("AOO", () => {
          const aoo = extractor("Denominazione_aoo", z.string());
          const agency = extractor("Denominazione_ente", z.string());

          if (!aoo || !agency) {
            return undefined;
          }

          return `${aoo} - ${agency}`;
        })
        .with("UO", () => {
          const uo = extractor("Descrizione_uo", z.string());
          const agency = extractor("Denominazione_ente", z.string());

          if (!uo || !agency) {
            return undefined;
          }

          return `${uo} - ${agency}`;
        })
        .exhaustive();
      if (!description) {
        return accumulator;
      }

      const digitalAddress = extractor("Mail1", z.string());
      if (!digitalAddress) {
        return accumulator;
      }

      const address = extractor("Indirizzo", z.string());
      if (!address) {
        return accumulator;
      }

      const zipCode = extractor("CAP", z.string());
      if (!zipCode) {
        return accumulator;
      }

      const kind = match(institutionKind)
        .with("Agency", () => extractor("Tipologia", z.string()))
        .otherwise(() => {
          const originId = extractor("Codice_IPA", z.string());
          if (!originId) {
            return undefined;
          }
          return institutionsDetails.get(originId)?.kind;
        });
      if (!kind) {
        return accumulator;
      }

      accumulator.push({
        id: taxCode,
        originId,
        taxCode,
        category,
        description,
        digitalAddress,
        address,
        zipCode,
        origin: config.ipaOrigin,
        kind,
        classification: match<InstitutionKind, Classification>(institutionKind)
          .with("Agency", () => "Agency")
          .with("AOO", () => "AOO")
          .with("UO", () => "UO")
          .exhaustive(),
      });

      return accumulator;
    },
    []
  );
}
