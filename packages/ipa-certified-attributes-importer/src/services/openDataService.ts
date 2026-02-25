import { createHash } from "crypto";
import { match, P } from "ts-pattern";
import { PUBLIC_ADMINISTRATIONS_TYPOLOGY } from "pagopa-interop-models";
import {
  Category,
  Institution,
  OpenDataConfig,
  getAllCategories,
  getAllInstitutions,
} from "./openDataExtractor.js";
import { ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY } from "./ipaCertifiedAttributesImporterService.js";

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
  const institutions = await getAllInstitutions(
    "Agency",
    new Map(),
    openDataConfig
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

  const aoo = await getAllInstitutions("AOO", institutionsDetails, openDataConfig);

  const uo = await getAllInstitutions("UO", institutionsDetails, openDataConfig);

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

export async function getRegistryData(
  openDataConfig: OpenDataConfig
): Promise<RegistryData> {
  const openData = await loadOpenData(openDataConfig);

  const allInstitutions = [
    ...openData.institutions,
    ...openData.aoo,
    ...openData.uo,
  ];

  const attributes = await loadCertifiedAttributes(openData);

  return {
    institutions: allInstitutions,
    attributes,
  };
}
