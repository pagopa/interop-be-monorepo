import { Filter, WithId } from "mongodb";
import { z } from "zod";
import {
  AttributeCollection,
  logger,
  ReadModelRepository,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  AttributeKind,
  Attribute,
  WithMetadata,
  ListResult,
  genericError,
  Tenant,
  AttributeId,
  TenantId,
  AttributeReadmodel,
} from "pagopa-interop-models";
async function getAttribute(
  attributes: AttributeCollection,
  filter: Filter<WithId<WithMetadata<AttributeReadmodel>>>
): Promise<WithMetadata<Attribute> | undefined> {
  const data = await attributes.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: Attribute,
      })
      .safeParse(data);
    if (!result.success) {
      logger.error(
        `Unable to parse attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse attribute item");
    }
    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
}

async function getTenant(
  tenants: TenantCollection,
  filter: Filter<WithId<WithMetadata<Tenant>>>
): Promise<WithMetadata<Tenant> | undefined> {
  const data = await tenants.findOne(filter, {
    projection: { data: true, metadata: true },
  });

  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: Tenant,
      })
      .safeParse(data);

    if (!result.success) {
      logger.error(
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw genericError("Unable to parse tenant item");
    }

    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
}

async function getAttributes({
  attributes,
  aggregationPipeline,
  offset,
  limit,
}: {
  attributes: AttributeCollection;
  aggregationPipeline: object[];
  offset: number;
  limit: number;
}): Promise<ListResult<Attribute>> {
  const data = await attributes
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
    .toArray();
  const result = z.array(Attribute).safeParse(data.map((d) => d.data));
  if (!result.success) {
    logger.error(
      `Unable to parse attributes items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw genericError("Unable to parse attribute items");
  }
  return {
    results: result.data,
    totalCount: await ReadModelRepository.getTotalCount(
      attributes,
      aggregationPipeline
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { attributes, tenants } = readModelRepository;

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
      return getAttributes({
        attributes,
        aggregationPipeline: [
          {
            $match: {
              "data.id": {
                $in: ids,
              },
            },
          },
          {
            $project: {
              data: 1,
              computedColumn: { $toLower: ["$data.name"] },
            },
          },
          {
            $sort: { computedColumn: 1 },
          },
        ],
        offset,
        limit,
      });
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
      const nameFilter = name
        ? {
            "data.name": {
              $regex: ReadModelRepository.escapeRegExp(name),
              $options: "i",
            },
          }
        : {};
      const originFilter = origin
        ? {
            "data.origin": origin,
          }
        : {};
      const aggregationPipeline = [
        {
          $match: {
            ...nameFilter,
            ...originFilter,
            ...ReadModelRepository.arrayToFilter<Attribute>(kinds, {
              "data.kind": { $in: kinds },
            }),
          },
        },
        {
          $project: {
            data: 1,
            computedColumn: { $toLower: ["$data.name"] },
          },
        },
        {
          $sort: { computedColumn: 1 },
        },
      ];
      return getAttributes({
        attributes,
        aggregationPipeline,
        offset,
        limit,
      });
    },

    async getAttributeById(
      id: AttributeId
    ): Promise<WithMetadata<Attribute> | undefined> {
      return getAttribute(attributes, { "data.id": id });
    },

    async getAttributeByName(
      name: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      return getAttribute(attributes, {
        "data.name": {
          $regex: `^${ReadModelRepository.escapeRegExp(name)}$$`,
          $options: "i",
        },
      });
    },

    async getAttributeByOriginAndCode({
      origin,
      code,
    }: {
      origin: string;
      code: string;
    }): Promise<WithMetadata<Attribute> | undefined> {
      return getAttribute(attributes, {
        "data.origin": origin,
        "data.code": code,
      });
    },

    async getAttributeByCodeAndName(
      code: string,
      name: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      return getAttribute(attributes, {
        "data.code": {
          $regex: `^${ReadModelRepository.escapeRegExp(code)}$$`,
          $options: "i",
        },
        "data.name": {
          $regex: `^${ReadModelRepository.escapeRegExp(name)}$$`,
          $options: "i",
        },
      });
    },
    async getTenantById(
      tenantId: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, { "data.id": tenantId });
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
