import { createHash } from "crypto";
import { PUBLIC_ADMINISTRATIONS_TYPOLOGY } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

import type { OpenDataConfig } from "../config/openDataConfig.js";

import {
  ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
  toAttributeKey,
  toTenantKey,
} from "./ipaCertifiedAttributesImporterService.js";
import {
  Category,
  getAllCategories,
  getAllInstitutions,
  Institution,
} from "./openDataExtractor.js";

/**
 * Determine if an institution's "kind" and "category" should lead to the inclusion
 * of a certified attribute.
 */
export const shouldKindBeIncluded = (i: {
  kind: string;
  category: string;
}): boolean =>
  match(i)
    .with(
      {
        kind: P.union(
          PUBLIC_ADMINISTRATIONS_TYPOLOGY,
          ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY
        ),
      },
      () => true
    )
    .otherwise(() => false);

type OpenData = {
  institutions: Institution[];
  aoo: Institution[];
  uo: Institution[];
  categories: Category[];
};

export type InternalCertifiedAttribute = {
  code: string;
  description: string;
  origin: string;
  name: string;
};

export type RegistryData = {
  institutions: Institution[];
  attributes: InternalCertifiedAttribute[];
};

async function loadOpenData(openDataConfig: OpenDataConfig): Promise<OpenData> {
  const institutions = dedupeInstitutions(
    await getAllInstitutions("Agency", new Map(), openDataConfig)
  );

  const institutionsDetails = new Map(
    institutions.map((institution) => [
      institution.originId,
      {
        category: institution.category,
        kind: institution.kind,
      },
    ])
  );

  const aoo = await getAllInstitutions(
    "AOO",
    institutionsDetails,
    openDataConfig
  );

  const uo = await getAllInstitutions(
    "UO",
    institutionsDetails,
    openDataConfig
  );

  const categories = await getAllCategories(openDataConfig);

  return {
    institutions,
    aoo,
    uo,
    categories,
  };
}

async function loadCertifiedAttributes(
  data: OpenData
): Promise<InternalCertifiedAttribute[]> {
  const attributesSeedsCategoriesNames = data.categories.map((c) => ({
    code: c.code,
    description: c.name,
    name: c.name,
    origin: c.origin,
  }));

  const attributeSeedsCategoriesKinds = [
    ...new Map(data.categories.map((c) => [c.kind, c])),
  ]
    .filter(([kind, category]) =>
      shouldKindBeIncluded({ kind, category: category.code })
    )
    .map(([_, c]) => ({
      code: createHash("sha256").update(c.kind).digest("hex"),
      description: c.kind,
      /**
       * Società in Conto Economico Consolidato exists both as a category and as a type.
       * To avoid duplicates, we add the suffix ' - Tipologia IPA' to the name of the type.
       */
      name: match(c.kind)
        .with(
          ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
          () => `${c.name} - Tipologia IPA`
        )
        .otherwise(() => c.name),
      origin: c.origin,
    }));

  const attributeSeedsCategories = [
    ...attributesSeedsCategoriesNames,
    ...attributeSeedsCategoriesKinds,
  ];

  const attributeSeedsInstitutions = data.institutions.map((i) => ({
    code: i.originId,
    description: i.description,
    origin: i.origin,
    name: i.description,
  }));

  return [...attributeSeedsCategories, ...attributeSeedsInstitutions];
}

export function dedupeInstitutions(institutions: Institution[]): Institution[] {
  const seen = new Set<string>();

  return institutions.filter((i) => {
    const key = toTenantKey({ origin: i.origin, value: i.originId });

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function dedupeCertifiedAttributes(
  attributes: InternalCertifiedAttribute[]
): InternalCertifiedAttribute[] {
  const seen = new Set<string>();

  return attributes.filter((a) => {
    const key = toAttributeKey({ origin: a.origin, code: a.code });

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function getRegistryData(
  openDataConfig: OpenDataConfig
): Promise<RegistryData> {
  const openData = await loadOpenData(openDataConfig);

  const allInstitutions = dedupeInstitutions([
    ...openData.institutions,
    ...openData.aoo,
    ...openData.uo,
  ]);

  const attributes = dedupeCertifiedAttributes(
    await loadCertifiedAttributes(openData)
  );

  return {
    institutions: allInstitutions,
    attributes,
  };
}
