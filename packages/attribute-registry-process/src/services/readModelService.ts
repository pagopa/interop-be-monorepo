import { Filter } from "mongodb";
import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  AttributeKind,
  Attribute,
  WithMetadata,
  genericError,
  ListResult,
} from "pagopa-interop-models";
import { config } from "../utilities/config.js";

const { attributes } = ReadModelRepository.init(config);

async function getAttribute(
  filter: Filter<{ data: Attribute }>
): Promise<WithMetadata<Attribute> | undefined> {
  const data = await attributes.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  }
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
      throw genericError("Unable to parse attributes items");
    }
    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };}

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
          ...ReadModelRepository.arrayToFilter(kinds, (kinds) => ({
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
      throw genericError("Unable to parse attributes items");
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
