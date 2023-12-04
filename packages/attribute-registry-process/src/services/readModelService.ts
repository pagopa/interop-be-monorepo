import { Filter } from "mongodb";
import { z } from "zod";
import {
  AttributeCollection,
  logger,
  ReadModelFilter,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  AttributeKind,
  Attribute,
  WithMetadata,
  ListResult,
  genericError,
} from "pagopa-interop-models";
import { AttributeRegistryConfig } from "../utilities/config.js";

async function getAttribute(
  attributes: AttributeCollection,
  filter: Filter<{ data: Attribute }>
): Promise<WithMetadata<Attribute> | undefined> {
  const data = await attributes.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (data) {
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
  return undefined;
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
export function readModelServiceBuilder(config: AttributeRegistryConfig) {
  const { attributes } = ReadModelRepository.init(config);
  return {
    async getAttributesByIds({
      ids,
      offset,
      limit,
    }: {
      ids: string[];
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
              $regex: name,
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
            ...ReadModelRepository.arrayToFilter(kinds, {
              "data.kind": { $in: kinds },
            }),
          } satisfies ReadModelFilter<Attribute>,
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
      id: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      return getAttribute(attributes, { "data.id": id });
    },

    async getAttributeByName(
      name: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      return getAttribute(attributes, {
        "data.name": {
          $regex: `^${name}$$`,
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
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
