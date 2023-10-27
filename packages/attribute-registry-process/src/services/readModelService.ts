import { AggregationCursor, MongoClient } from "mongodb";
import { z } from "zod";
import { logger } from "pagopa-interop-commons";
import {
  AttributeKind,
  AttributeTmp,
  Document,
  ErrorTypes,
  WithMetadata,
} from "pagopa-interop-models";
import { config } from "../utilities/config.js";
import { ListResult } from "../model/types.js";

const {
  readModelDbUsername: username,
  readModelDbPassword: password,
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbName: database,
} = config;

const mongoDBConectionURI = `mongodb://${username}:${password}@${host}:${port}`;
const client = new MongoClient(mongoDBConectionURI, {
  retryWrites: false,
});

const db = client.db(database);
const attributes = db.collection("attributes");

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
      name?: string | undefined;
      origin?: string | undefined;
    },
    offset: number,
    limit: number
  ): Promise<ListResult<AttributeTmp>> {
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
