import {
  ascLower,
  createListResult,
  escapeRegExp,
  getTableTotalCount,
} from "pagopa-interop-commons";
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
import { and, eq, getTableColumns, ilike, inArray } from "drizzle-orm";

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
      const baseQuery = readModelDB
        .select(getTableColumns(attributeInReadmodelAttribute))
        .from(attributeInReadmodelAttribute)
        .where(inArray(attributeInReadmodelAttribute.id, ids))
        .orderBy(ascLower(attributeInReadmodelAttribute.name))
        .$dynamic();

      const [totalCount, queryResult] = await Promise.all([
        getTableTotalCount(readModelDB, baseQuery),
        baseQuery.limit(limit).offset(offset),
      ]);

      const attributes = aggregateAttributeArray(queryResult);

      return createListResult(
        attributes.map((attr) => attr.data),
        totalCount
      );
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
      const baseQuery = readModelDB
        .select(getTableColumns(attributeInReadmodelAttribute))
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
        .$dynamic();

      const [totalCount, queryResult] = await Promise.all([
        getTableTotalCount(readModelDB, baseQuery),
        baseQuery.limit(limit).offset(offset),
      ]);

      const attributes = aggregateAttributeArray(queryResult);

      return createListResult(
        attributes.map((attr) => attr.data),
        totalCount
      );
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
