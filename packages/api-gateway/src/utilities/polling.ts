import { WithLogger } from "pagopa-interop-commons";
import { makeApiProblem } from "../models/errors.js";
import { ApiGatewayAppContext } from "./context.js";
import { getAttributeErrorMapper } from "./errorMappers.js";

/**
 * Generic polling function that waits until an object is created and meets certain criteria
 *
 * @param fetchFn - Function to fetch the object
 * @param id - ID of the object to poll for
 * @param options - Optional configuration
 * @returns Promise that resolves to the created/ready object
 */
export async function pollUntilReady<T>(
  fetchFn: (
    ctx: WithLogger<ApiGatewayAppContext>,
    id: string
  ) => Promise<T | null>,
  ctx: WithLogger<ApiGatewayAppContext>,
  id: string,
  options: {
    checkFn: (obj: T) => boolean;
    maxAttempts: number;
    intervalMs: number;
  }
): Promise<T> {
  const {
    checkFn = (obj: T): boolean => obj !== null && obj !== undefined,
    maxAttempts,
    intervalMs,
  } = options || {};

  // eslint-disable-next-line functional/no-let
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      // This assumes the fetch function always needs a context and an id as the only 2 parameters
      // This could be improved
      const result = await fetchFn(ctx, id);

      if (!result) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      if (!checkFn(result)) {
        // TODO: improve this, the idea is that this will then be remapped in the catch
        throw new Error("Expected resource does not meet criteria");
      }

      return result;
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        getAttributeErrorMapper, // use mapper of error mappers? this depends on the fetch function
        ctx.logger,
        ctx.correlationId
      );

      // TODO: improve this check, this is just the initial idea
      if (errorRes.status === 404) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      throw errorRes;
    }
  }

  // This also could be mapped to a specific timeout error
  throw new Error(`Polling timed out after ${attempts} attempts for id: ${id}`);
}
