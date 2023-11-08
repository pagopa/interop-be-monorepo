import { AggregationCursor, Filter } from "mongodb";
import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  AttributeKind,
  Attribute,
  Document,
  ErrorTypes,
  WithMetadata,
} from "pagopa-interop-models";
import { ListResult } from "../model/types.js";
import { config } from "../utilities/config.js";

const { attributes } = ReadModelRepository.init(config);

function arrayToFilter<T, F extends object>(
  array: T[],
  f: (array: T[]) => F
): F | undefined {
  return array.length > 0 ? f(array) : undefined;
}

async function getTotalCount(
  query: AggregationCursor<Document>
): Promise<number> {
  const data = await query.toArray();
  const result = z.array(z.object({ count: z.number() })).safeParse(data);

  if (result.success) {
    return result.data.length > 0 ? result.data[0].count : 0;
  }

  logger.error(
    `Unable to get total count from aggregation pipeline: result ${JSON.stringify(
      result
    )} - data ${JSON.stringify(data)} `
  );
  throw ErrorTypes.GenericError;
}

export const readModelService = {
  async getAttributes(
    {
      kinds,
      name,
      origin,
    }: {
      kinds: AttributeKind[];
      name?: string;
      origin?: string;
    },
    offset: number,
    limit: number
  ): Promise<ListResult<Attribute>> {
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
          ...arrayToFilter(kinds, (kinds) => ({
            "data.kind": { $in: kinds },
          })),
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
      throw ErrorTypes.GenericError;
    }
    return {
      results: result.data,
      totalCount: await getTotalCount(
        attributes.aggregate([...aggregationPipeline, { $count: "count" }])
      ),
    };
  },

  async getAttribute(
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
        throw ErrorTypes.GenericError;
      }
      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  },
  async getAttributeById(
    id: string
  ): Promise<WithMetadata<Attribute> | undefined> {
    return this.getAttribute({ "data.id": id });
  },

  async getAttributeByName(
    name: string
  ): Promise<WithMetadata<Attribute> | undefined> {
    return this.getAttribute({
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
    return this.getAttribute({
      "data.origin": origin,
      "data.code": code,
    });
  },
};
