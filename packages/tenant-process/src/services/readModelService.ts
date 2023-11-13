import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  Document,
  ErrorTypes,
  ListResult,
  Tenant,
} from "pagopa-interop-models";
import { AggregationCursor, Filter } from "mongodb";
import { config } from "../utilities/config.js";

const { tenants } = ReadModelRepository.init(config);

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

function listTenantsFilters(
  name: string | undefined
): Filter<{ data: Tenant }> {
  const nameFilter =
    name && name !== ""
      ? {
          "data.name": {
            $regex: name,
            $options: "i",
          },
        }
      : {};

  const withSelfcareIdFilter = {
    "data.selfcareId": {
      $exists: true,
    },
  };
  return {
    ...nameFilter,
    ...withSelfcareIdFilter,
  };
}

export const readModelService = {
  async getTenants(
    name: string | undefined,
    offset: number,
    limit: number
  ): Promise<ListResult<Tenant>> {
    const query = listTenantsFilters(name);
    const aggregationPipeline = [
      { $match: query },
      { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
      { $sort: { lowerName: 1 } },
    ];
    const data = await tenants
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();

    const result = z.array(Tenant).safeParse(data.map((d) => d.data));
    if (!result.success) {
      logger.error(
        `Unable to parse tenant items: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw ErrorTypes.GenericError;
    }

    return {
      results: result.data,
      totalCount: await getTotalCount(
        tenants.aggregate([...aggregationPipeline, { $count: "count" }])
      ),
    };
  },
};
