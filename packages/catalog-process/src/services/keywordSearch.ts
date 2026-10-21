import { and, Column, eq, inArray, SQL, sql } from "drizzle-orm";
import {
  DrizzleTransactionType,
  eserviceInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

// Keyword search, same approach as the public catalog: normalized text,
// Italian full text search that ignores accents, trigram similarity as fallback.
// normalize_text, italian_unaccent and the search_vector generated columns are
// defined in docker/readmodel-db. They are not part of the drizzle schema.
const normalizeText = (value: Column | SQL): SQL =>
  sql`public.normalize_text(${value})`;

const eserviceSearchVector = sql`${eserviceInReadmodelCatalog}.search_vector`;
const tenantSearchVector = sql`${tenantInReadmodelTenant}.search_vector`;
const eserviceName = normalizeText(eserviceInReadmodelCatalog.name);
const eserviceDescription = normalizeText(
  eserviceInReadmodelCatalog.description
);
const producerName = normalizeText(tenantInReadmodelTenant.name);

const eserviceTemplateSearchVector = sql`${eserviceTemplateInReadmodelEserviceTemplate}.search_vector`;
const eserviceTemplateName = normalizeText(
  eserviceTemplateInReadmodelEserviceTemplate.name
);
const eserviceTemplateDescription = normalizeText(
  eserviceTemplateInReadmodelEserviceTemplate.description
);

export const eserviceProducerJoin = eq(
  eserviceInReadmodelCatalog.producerId,
  tenantInReadmodelTenant.id
);

const keywordTsQuery = (keyword: string): SQL => {
  const normalizedKeyword = normalizeText(sql`${keyword}`);
  return sql`websearch_to_tsquery('public.italian_unaccent'::regconfig, ${normalizedKeyword})`;
};

// The e-service and the producer conditions are two UNION branches instead
// of one OR: an OR across two tables cannot use the GIN indexes.
const fullTextMatches = (keyword: string): SQL => {
  const tsQuery = keywordTsQuery(keyword);
  return sql`(SELECT ${eserviceInReadmodelCatalog.id} FROM ${eserviceInReadmodelCatalog}
    WHERE ${eserviceSearchVector} @@ ${tsQuery}
    UNION
    SELECT ${eserviceInReadmodelCatalog.id} FROM ${eserviceInReadmodelCatalog}
    JOIN ${tenantInReadmodelTenant} ON ${eserviceProducerJoin}
    WHERE ${tenantSearchVector} @@ ${tsQuery})`;
};

const fuzzyMatches = (keyword: string): SQL => {
  const normalizedKeyword = normalizeText(sql`${keyword}`);
  return sql`(SELECT ${eserviceInReadmodelCatalog.id} FROM ${eserviceInReadmodelCatalog}
    WHERE ${eserviceName} % ${normalizedKeyword}
      OR ${eserviceDescription} % ${normalizedKeyword}
    UNION
    SELECT ${eserviceInReadmodelCatalog.id} FROM ${eserviceInReadmodelCatalog}
    JOIN ${tenantInReadmodelTenant} ON ${eserviceProducerJoin}
    WHERE ${producerName} % ${normalizedKeyword})`;
};

// As in the public catalog, the trigram matches are the fallback when the
// full text search has no match at all. The check runs on the e-services the
// query can return: a match excluded by the other conditions must not disable
// the fallback.
export const eserviceKeywordFilter = async (
  tx: DrizzleTransactionType,
  keyword: string | undefined,
  condition: SQL | undefined
): Promise<SQL | undefined> => {
  if (keyword === undefined) {
    return undefined;
  }
  const fullTextFilter = inArray(
    eserviceInReadmodelCatalog.id,
    fullTextMatches(keyword)
  );
  const fullTextMatch = await tx
    .select({ id: eserviceInReadmodelCatalog.id })
    .from(eserviceInReadmodelCatalog)
    .where(and(condition, fullTextFilter))
    .limit(1);
  return fullTextMatch.length > 0
    ? fullTextFilter
    : inArray(eserviceInReadmodelCatalog.id, fuzzyMatches(keyword));
};

// The producer vector keeps weight A and the e-service vector is lowered to
// weight B, so a match on the producer name ranks first, as in the public catalog.
// The caller left joins the tenant on eserviceProducerJoin, so the tenant
// columns can be NULL.
export const eserviceKeywordRelevance = (keyword: string): SQL => {
  const tsQuery = keywordTsQuery(keyword);
  const normalizedKeyword = normalizeText(sql`${keyword}`);
  const searchVector = sql`COALESCE(${tenantSearchVector}, ''::tsvector) || setweight(${eserviceSearchVector}, 'B')`;
  const fullTextRank = sql`COALESCE(ts_rank_cd(${searchVector}, ${tsQuery}), 0)`;
  const fuzzySimilarity = sql`GREATEST(
    similarity(${eserviceName}, ${normalizedKeyword}),
    similarity(${eserviceDescription}, ${normalizedKeyword}),
    similarity(${producerName}, ${normalizedKeyword}))`;
  return sql`(${fullTextRank} + 0.5 * ${fuzzySimilarity})`;
};

// Name and description are in the same table, so one OR can use both trigram indexes.
const eserviceTemplateFuzzyMatch = (keyword: string): SQL => {
  const normalizedKeyword = normalizeText(sql`${keyword}`);
  // An empty keyword has no trigrams. The check skips a scan with no result.
  return sql`(${normalizedKeyword} <> ''
    AND (${eserviceTemplateName} % ${normalizedKeyword}
      OR ${eserviceTemplateDescription} % ${normalizedKeyword}))`;
};

// Same fallback rule as eserviceKeywordFilter. The check runs on the
// templates that the query can return.
export const eserviceTemplateKeywordFilter = async (
  tx: DrizzleTransactionType,
  keyword: string | undefined,
  condition: SQL | undefined
): Promise<SQL | undefined> => {
  if (keyword === undefined) {
    return undefined;
  }
  const fullTextFilter = sql`${eserviceTemplateSearchVector} @@ ${keywordTsQuery(keyword)}`;
  const fullTextMatch = await tx
    .select({ id: eserviceTemplateInReadmodelEserviceTemplate.id })
    .from(eserviceTemplateInReadmodelEserviceTemplate)
    .where(and(condition, fullTextFilter))
    .limit(1);
  return fullTextMatch.length > 0
    ? fullTextFilter
    : eserviceTemplateFuzzyMatch(keyword);
};

// The template vector gets weight B, as the e-service vector in
// eserviceKeywordRelevance. When the producer name does not match the keyword,
// a template and an e-service with the same name and description get the same
// score. A producer name match adds a weight A rank to the e-service score.
export const eserviceTemplateKeywordRelevance = (keyword: string): SQL => {
  const tsQuery = keywordTsQuery(keyword);
  const normalizedKeyword = normalizeText(sql`${keyword}`);
  const fullTextRank = sql`ts_rank_cd(setweight(${eserviceTemplateSearchVector}, 'B'), ${tsQuery})`;
  const fuzzySimilarity = sql`GREATEST(
    similarity(${eserviceTemplateName}, ${normalizedKeyword}),
    similarity(${eserviceTemplateDescription}, ${normalizedKeyword}))`;
  return sql`(${fullTextRank} + 0.5 * ${fuzzySimilarity})`;
};
