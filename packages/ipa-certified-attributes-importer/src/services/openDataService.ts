import { createHash } from "crypto";
import {
  Category,
  Institution,
  getAllCategories,
  getAllInstitutions,
} from "./openDataExtractor.js";

export const kindsToInclude: Set<string> = new Set([
  "Pubbliche Amministrazioni",
]);

export type OpenData = {
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

async function loadOpenData(): Promise<OpenData> {
  const institutions = await getAllInstitutions("Agency", new Map());

  const institutionsDetails = new Map(
    institutions.map((institution) => [
      institution.originId,
      {
        category: institution.category,
        kind: institution.kind,
      },
    ])
  );

  const aoo = await getAllInstitutions("AOO", institutionsDetails);

  const uo = await getAllInstitutions("UO", institutionsDetails);

  const categories = await getAllCategories();

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
    .filter(([kind, _]) => kindsToInclude.has(kind))
    .map(([_, c]) => ({
      code: createHash("sha256").update(c.kind).digest("hex"),
      description: c.kind,
      name: c.name,
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

export async function getRegistryData(): Promise<RegistryData> {
  const openData = await loadOpenData();

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
