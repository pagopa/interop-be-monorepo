/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable @typescript-eslint/array-type */
import axios from "axios";
import { z } from "zod";
import { match } from "ts-pattern";
import { PUBLIC_ADMINISTRATIONS_IDENTIFIER } from "pagopa-interop-models";
import { config } from "../config/config.js";

type Classification = "Agency" | "AOO" | "UO";

type InstitutionKind = "Agency" | "AOO" | "UO";

export type Institution = {
  id: string;
  originId: string;
  category: string;
  description: string;
  origin: string;
  kind: string;
  classification: Classification;
};

export type Category = {
  code: string;
  name: string;
  kind: string;
  origin: string;
};

const institutionsFields = [
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
type InstitutionsFields = (typeof institutionsFields)[number];

const categoriesFields = [
  "Codice_categoria",
  "Nome_categoria",
  "Tipologia_categoria",
] as const;
type CategoriesFields = (typeof categoriesFields)[number];

function fieldExtractor<K>(
  record: unknown[],
  fields: Map<K, number>
): <T>(key: K, decoder: z.ZodSchema<T>) => T | undefined {
  return (key, decoder) => {
    const valueIndex = fields.get(key);
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

function isCategoryField(field: string): field is CategoriesFields {
  return (categoriesFields as readonly string[]).includes(field);
}

export async function getAllCategories(): Promise<Category[]> {
  const response = await axios.get(config.institutionsCategoriesUrl);
  const responseFields = response.data.fields as Array<{ id: string }>;
  const responseRecords = response.data.records as Array<any>;

  const fields: Map<CategoriesFields, number> = new Map(
    responseFields
      .map<[string, number]>((f, index) => [f.id, index])
      .filter((data): data is [CategoriesFields, number] =>
        isCategoryField(data[0])
      )
  );

  return responseRecords.reduce<Category[]>((accumulator, record: any[]) => {
    const extractor = fieldExtractor<CategoriesFields>(record, fields);

    const code = extractor("Codice_categoria", z.string());
    if (!code) {
      return accumulator;
    }

    const name = extractor("Nome_categoria", z.string());
    if (!name) {
      return accumulator;
    }

    const kind = extractor("Tipologia_categoria", z.string());
    if (!kind) {
      return accumulator;
    }

    // eslint-disable-next-line functional/immutable-data
    accumulator.push({
      code,
      name,
      kind,
      origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
    });

    return accumulator;
  }, []);
}

function isInstitutionsField(field: string): field is InstitutionsFields {
  return (institutionsFields as readonly string[]).includes(field);
}

export async function getAllInstitutions(
  institutionKind: InstitutionKind,
  institutionsDetails: Map<string, { category: string; kind: string }>
): Promise<Institution[]> {
  const url = match(institutionKind)
    .with("Agency", () => config.institutionsUrl)
    .with("AOO", () => config.aooUrl)
    .with("UO", () => config.uoUrl)
    .exhaustive();

  const response = await axios.get(url);
  const responseFields = response.data.fields as Array<{ id: string }>;
  const responseRecords = response.data.records as Array<any>;

  if (!response.data.fields) {
    return [];
  }

  const fields: Map<InstitutionsFields, number> = new Map(
    responseFields
      .map<[string, number]>((f, index) => [f.id, index])
      .filter((data): data is [InstitutionsFields, number] =>
        isInstitutionsField(data[0])
      )
  );

  return responseRecords.reduce<Institution[]>((accumulator, record: any[]) => {
    const extractor = fieldExtractor<InstitutionsFields>(record, fields);

    const taxCode = extractor("Codice_fiscale_ente", z.string());
    if (!taxCode) {
      return accumulator;
    }

    const originId = extractor(
      match<InstitutionKind, InstitutionsFields>(institutionKind)
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

    // eslint-disable-next-line functional/immutable-data
    accumulator.push({
      id: taxCode,
      originId,
      category,
      description,
      origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
      kind,
      classification: match<InstitutionKind, Classification>(institutionKind)
        .with("Agency", () => "Agency")
        .with("AOO", () => "AOO")
        .with("UO", () => "UO")
        .exhaustive(),
    });

    return accumulator;
  }, []);
}
