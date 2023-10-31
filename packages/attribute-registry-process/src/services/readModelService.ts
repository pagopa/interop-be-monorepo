import { AggregationCursor } from "mongodb";
import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  AttributeKind,
  AttributeTmp,
  Document,
  ErrorTypes,
  WithMetadata,
} from "pagopa-interop-models";
import { ListResult } from "../model/types.js";
import { config } from "../utilities/config.js";
import { match } from "ts-pattern";

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

type FilterCriteria =
  | { type: "ids"; data: string[] }
  | {
      type: "values";
      data: {
        kinds: AttributeKind[];
        name?: string | undefined;
        origin?: string | undefined;
      };
    };

export const readModelService = {
  async getAttributes(
    filter: FilterCriteria,
    offset: number,
    limit: number
  ): Promise<ListResult<AttributeTmp>> {
    const aggregationPipeline = match(filter)
      .with({ type: "ids" }, ({ data: ids }) => {
        return [
          {
            $match: {
              "data.id": {
                $in: ids,
              },
            },
          },
        ];
      })
      .with({ type: "values" }, ({ data: { kinds, name, origin } }) => {
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
        return [
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
      })
      .exhaustive();

    const data = await attributes
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();
    const result = z.array(AttributeTmp).safeParse(data.map((d) => d.data));
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

  async getAttributeById(
    id: string
  ): Promise<WithMetadata<AttributeTmp> | undefined> {
    const data = await attributes.findOne(
      { "data.id": id },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: AttributeTmp,
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

  async getAttributeByName(
    name: string
  ): Promise<WithMetadata<AttributeTmp> | undefined> {
    const data = await attributes.findOne(
      {
        "data.name": {
          $regex: `^${name}$$`,
          $options: "i",
        },
      },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: AttributeTmp,
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
  async getAttributeByOriginAndCode({
    origin,
    code,
  }: {
    origin: string;
    code: string;
  }): Promise<WithMetadata<AttributeTmp> | undefined> {
    const codeFilter = {
      "data.code": code,
    };
    const originFilter = {
      "data.origin": origin,
    };
    const data = await attributes.findOne(
      {
        codeFilter,
        originFilter,
      },
      { projection: { data: true, metadata: true } }
    );
    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: AttributeTmp,
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
};
