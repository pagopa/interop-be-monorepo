import { escapeRegExp } from "pagopa-interop-commons";
import {
  AttributeKind,
  Attribute,
  WithMetadata,
  ListResult,
  Tenant,
  AttributeId,
  TenantId,
} from "pagopa-interop-models";
import {
  aggregateAttributeArray,
  AttributeReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import {
  and,
  eq,
  getTableColumns,
  ilike,
  inArray,
  sql,
  asc,
  SQL,
  Table,
  Column,
} from "drizzle-orm";

function createListResult<T>(
  items: Array<{ data: T }>,
  totalCount?: number
): { results: T[]; totalCount: number } {
  return {
    results: items.map((item) => item.data),
    totalCount: totalCount ?? 0,
  };
}

// see: https://orm.drizzle.team/docs/guides/limit-offset-pagination
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ascLower = <T = string>(column: Column | SQL | SQL.Aliased) =>
  asc(sql<T>`LOWER(${column})`);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const withTotalCount = <T extends Table>(tbl: T) => ({
  ...getTableColumns(tbl),
  totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  attributeReadModelServiceSQL,
  tenantReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  attributeReadModelServiceSQL: AttributeReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
}) {
  return {
    async getAttributesByIds({
      ids,
      offset,
      limit,
    }: {
      ids: AttributeId[];
      offset: number;
      limit: number;
    }): Promise<ListResult<Attribute>> {
      const queryResult = await readModelDB
        .select(withTotalCount(attributeInReadmodelAttribute))
        .from(attributeInReadmodelAttribute)
        .where(inArray(attributeInReadmodelAttribute.id, ids))
        .orderBy(ascLower(attributeInReadmodelAttribute.name))
        .limit(limit)
        .offset(offset);

      const attributes = aggregateAttributeArray(queryResult);

      return createListResult(attributes, queryResult[0]?.totalCount);
    },
    async getAttributesByKindsNameOrigin({
      kinds,
      name,
      origin,
      offset,
      limit,
    }: {
      kinds: AttributeKind[];
      name?: string;
      origin?: string;
      offset: number;
      limit: number;
    }): Promise<ListResult<Attribute>> {
      const queryResult = await readModelDB
        .select(withTotalCount(attributeInReadmodelAttribute))
        .from(attributeInReadmodelAttribute)
        .where(
          and(
            kinds.length > 0
              ? inArray(attributeInReadmodelAttribute.kind, kinds)
              : undefined,
            name
              ? ilike(
                  attributeInReadmodelAttribute.name,
                  `%${escapeRegExp(name)}%`
                )
              : undefined,
            origin
              ? eq(attributeInReadmodelAttribute.origin, origin)
              : undefined
          )
        )
        .orderBy(ascLower(attributeInReadmodelAttribute.name))
        .limit(limit)
        .offset(offset);

      const attributes = aggregateAttributeArray(queryResult);

      return createListResult(attributes, queryResult[0]?.totalCount);
    },
    async getAttributeById(
      id: AttributeId
    ): Promise<WithMetadata<Attribute> | undefined> {
      return attributeReadModelServiceSQL.getAttributeById(id);
    },
    async getAttributeByName(
      name: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      return attributeReadModelServiceSQL.getAttributeByFilter(
        ilike(attributeInReadmodelAttribute.name, escapeRegExp(name))
      );
    },
    async getAttributeByOriginAndCode({
      origin,
      code,
    }: {
      origin: string;
      code: string;
    }): Promise<WithMetadata<Attribute> | undefined> {
      return await attributeReadModelServiceSQL.getAttributeByFilter(
        and(
          eq(attributeInReadmodelAttribute.origin, escapeRegExp(origin)),
          eq(attributeInReadmodelAttribute.code, escapeRegExp(code))
        )
      );
    },
    async getAttributeByCodeAndName(
      code: string,
      name: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      return await attributeReadModelServiceSQL.getAttributeByFilter(
        and(
          ilike(attributeInReadmodelAttribute.code, escapeRegExp(code)),
          ilike(attributeInReadmodelAttribute.name, escapeRegExp(name))
        )
      );
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
