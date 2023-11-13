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
import { Collection } from "mongodb";
import { ListResult } from "../model/types.js";
import { config } from "../utilities/config.js";

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

export class ReadModelService {
  private attributes: Collection<{
    data: AttributeTmp;
    metadata: { version: number };
  }>;
  constructor(
    attributes?: Collection<{
      data: AttributeTmp;
      metadata: { version: number };
    }>
  ) {
    this.attributes = attributes || ReadModelRepository.init(config).attributes;
  }

  public async getAttributes(
    {
      ids,
      kinds,
      name,
      origin,
    }: {
      ids?: string[];
      kinds: AttributeKind[];
      name?: string;
      origin?: string;
    },
    offset: number,
    limit: number
  ): Promise<ListResult<AttributeTmp>> {
    const idsFilter = ids
      ? {
          "data.id": {
            $in: ids,
          },
        }
      : {};
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
          ...idsFilter,
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
    const data = await this.attributes
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
        this.attributes.aggregate([...aggregationPipeline, { $count: "count" }])
      ),
    };
  }

  public async getAttributeById(
    id: string
  ): Promise<WithMetadata<AttributeTmp> | undefined> {
    const data = await this.attributes.findOne(
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
  }

  public async getAttributeByName(
    name: string
  ): Promise<WithMetadata<AttributeTmp> | undefined> {
    const data = await this.attributes.findOne(
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
  }

  public async getAttributeByOriginAndCode({
    origin,
    code,
  }: {
    origin: string;
    code: string;
  }): Promise<WithMetadata<AttributeTmp> | undefined> {
    const data = await this.attributes.findOne(
      {
        "data.code": code,
        "data.origin": origin,
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
  }
}
