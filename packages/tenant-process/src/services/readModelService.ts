import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import { ErrorTypes, ListResult, Tenant } from "pagopa-interop-models";
import { Filter } from "mongodb";
import { config } from "../utilities/config.js";

const { tenants } = ReadModelRepository.init(config);

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
      totalCount: await ReadModelRepository.getTotalCount(
        tenants,
        aggregationPipeline
      ),
    };
  },
};
