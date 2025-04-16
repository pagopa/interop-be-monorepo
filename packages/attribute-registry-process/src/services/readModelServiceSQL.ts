import { ReadModelRepository } from "pagopa-interop-commons";
import {
  AttributeKind,
  Attribute,
  WithMetadata,
  ListResult,
  Tenant,
  AttributeId,
  TenantId,
} from "pagopa-interop-models";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  aggregateAttributeArray,
  AttributeReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";
import { and, eq, getTableColumns, ilike, inArray, sql } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  attributeReadModelServiceSQL,
  tenantReadModelServiceSQL,
}: {
  readModelDB: ReturnType<typeof drizzle>;
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
        .select({
          ...getTableColumns(attributeInReadmodelAttribute),
          totalCount: sql`COUNT(*) OVER()`.as("totalCount"),
        })
        .from(attributeInReadmodelAttribute)
        .where(inArray(attributeInReadmodelAttribute.id, ids))
        .orderBy(sql`LOWER(${attributeInReadmodelAttribute.name})`)
        .limit(limit)
        .offset(offset);

      const attributes = aggregateAttributeArray(queryResult);

      return {
        results: attributes.map((attr) => attr.data),
        totalCount: Number(queryResult[0]?.totalCount || 0),
      };
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
        .select({
          ...getTableColumns(attributeInReadmodelAttribute),
          totalCount: sql`COUNT(*) OVER()`.as("totalCount"),
        })
        .from(attributeInReadmodelAttribute)
        .where(
          and(
            kinds.length > 0
              ? inArray(attributeInReadmodelAttribute.kind, kinds)
              : undefined,
            name
              ? ilike(
                  attributeInReadmodelAttribute.name,
                  `%${ReadModelRepository.escapeRegExp(name)}%`
                )
              : undefined,
            origin
              ? eq(attributeInReadmodelAttribute.origin, origin)
              : undefined
          )
        )
        .orderBy(sql`LOWER(${attributeInReadmodelAttribute.name})`)
        .limit(limit)
        .offset(offset);

      const attributes = aggregateAttributeArray(queryResult);

      return {
        results: attributes.map((attr) => attr.data),
        totalCount: Number(queryResult[0]?.totalCount || 0),
      };
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
        ilike(
          attributeInReadmodelAttribute.name,
          ReadModelRepository.escapeRegExp(name)
        )
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
          eq(
            attributeInReadmodelAttribute.origin,
            ReadModelRepository.escapeRegExp(origin)
          ),
          eq(
            attributeInReadmodelAttribute.code,
            ReadModelRepository.escapeRegExp(code)
          )
        )
      );
    },
    async getAttributeByCodeAndName(
      code: string,
      name: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      return await attributeReadModelServiceSQL.getAttributeByFilter(
        and(
          ilike(
            attributeInReadmodelAttribute.code,
            ReadModelRepository.escapeRegExp(code)
          ),
          ilike(
            attributeInReadmodelAttribute.name,
            ReadModelRepository.escapeRegExp(name)
          )
        )
      );
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
