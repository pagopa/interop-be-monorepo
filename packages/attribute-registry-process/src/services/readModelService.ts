import { Filter } from "mongodb";
import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  AttributeKind,
  Attribute,
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

async function getAttribute(
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
}

export const readModelService = {
  async getAttributes(
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
  ): Promise<ListResult<Attribute>> {
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
      totalCount: await ReadModelRepository.getTotalCount(
        attributes,
        aggregationPipeline
      ),
    };
  },

  async getAttributeById(
    id: string
  ): Promise<WithMetadata<Attribute> | undefined> {
    return getAttribute({ "data.id": id });
  },

  async getAttributeByName(
    name: string
  ): Promise<WithMetadata<Attribute> | undefined> {
    return getAttribute({
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
    return getAttribute({
      "data.origin": origin,
      "data.code": code,
    });
  },
};
