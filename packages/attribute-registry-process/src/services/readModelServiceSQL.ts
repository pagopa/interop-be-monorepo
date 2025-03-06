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
  aggregateAttribute,
  aggregateAttributeArray,
  AttributeReadModelServiceSQL,
  TenantReadModelServiceSQL,
} from "pagopa-interop-readmodel";
import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";
import { and, count, ilike, inArray } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(
  readModelDB: ReturnType<typeof drizzle>,
  attributeReadModelService: AttributeReadModelServiceSQL,
  tenantReadModelService: TenantReadModelServiceSQL
) {
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
      const condition = inArray(attributeInReadmodelAttribute.id, ids);
      const res = await readModelDB
        .select()
        .from(attributeInReadmodelAttribute)
        .where(condition)
        .orderBy(attributeInReadmodelAttribute.name) // TODO this was $toLower: ["$data.name"]
        .limit(limit)
        .offset(offset);

      const attributes = aggregateAttributeArray(res);

      const totalCount = await readModelDB
        .select({ count: count() })
        .from(attributeInReadmodelAttribute)
        .where(condition);

      return {
        results: attributes.map((attr) => attr.data),
        totalCount: totalCount[0].count,
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
      const condition = and(
        kinds.length > 0
          ? inArray(attributeInReadmodelAttribute.kind, kinds)
          : undefined,
        name
          ? ilike(attributeInReadmodelAttribute.name, `%${name}%`)
          : undefined,
        origin ? ilike(attributeInReadmodelAttribute.origin, origin) : undefined
      );
      const res = await readModelDB
        .select()
        .from(attributeInReadmodelAttribute)
        .where(condition)
        .orderBy(attributeInReadmodelAttribute.name) // TODO this was $toLower: ["$data.name"]
        .limit(limit)
        .offset(offset);

      const attributes = aggregateAttributeArray(res);

      const totalCount = await readModelDB
        .select({ count: count() })
        .from(attributeInReadmodelAttribute)
        .where(condition);

      return {
        results: attributes.map((attr) => attr.data),
        totalCount: totalCount[0].count,
      };
    },

    async getAttributeById(
      id: AttributeId
    ): Promise<WithMetadata<Attribute> | undefined> {
      return attributeReadModelService.getAttributeById(id);
    },

    async getAttributeByName(
      // TODO ADD UNIQUE IN DB
      name: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      const res = await readModelDB
        .select()
        .from(attributeInReadmodelAttribute)
        .where(
          ilike(
            attributeInReadmodelAttribute.name,
            ReadModelRepository.escapeRegExp(name)
          )
        );

      if (res.length === 0) {
        return undefined; // TODO move into aggregator?
      }

      return aggregateAttribute(res[0]);
    },

    async getAttributeByOriginAndCode({
      origin,
      code,
    }: {
      origin: string;
      code: string;
    }): Promise<WithMetadata<Attribute> | undefined> {
      const res = await readModelDB
        .select()
        .from(attributeInReadmodelAttribute)
        .where(
          and(
            ilike(
              attributeInReadmodelAttribute.origin,
              ReadModelRepository.escapeRegExp(origin)
            ),
            ilike(
              attributeInReadmodelAttribute.code,
              ReadModelRepository.escapeRegExp(code)
            )
          )
        );

      if (res.length === 0) {
        return undefined; // TODO move into aggregator?
      }

      return aggregateAttribute(res[0]);
    },

    async getAttributeByCodeAndName(
      code: string,
      name: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      const res = await readModelDB
        .select()
        .from(attributeInReadmodelAttribute)
        .where(
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

      if (res.length === 0) {
        return undefined; // TODO move into aggregator?
      }

      return aggregateAttribute(res[0]);
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      const tenantWithMetadata = await tenantReadModelService.getTenantById(
        tenantId
      );
      return tenantWithMetadata?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
