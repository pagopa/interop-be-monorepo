// import { z } from "zod";
// import { logger, ReadModelRepository } from "pagopa-interop-commons";
// import { ErrorTypes, WithMetadata } from "pagopa-interop-models";
// import { config } from "../utilities/config.js";
// import { PersistentTenant } from "./../../../models/src/tenant/tenant.js";

// const { tenants } = ReadModelRepository.init(config);

/*
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
*/

export const readModelService = {};
