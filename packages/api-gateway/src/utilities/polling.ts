import { WithLogger } from "pagopa-interop-commons";
import { ApiError } from "pagopa-interop-models";
import { makeApiProblem } from "../models/errors.js";
import { ApiGatewayAppContext } from "./context.js";
import { ErrorCodes } from "./errorMappers.js";

/**
 * Generic polling function that waits until an object is created and meets certain criteria
 *
 * @param fetchPromiseFactory - Function that returns a Promise to fetch the object
 * @param options - Additional configuration
 * @returns Promise that resolves to the created/ready object
 */
export async function pollUntilReady<T>(
  fetchPromiseFactory: () => Promise<T | null>,
  ctx: WithLogger<ApiGatewayAppContext>,
  options: {
    checkFn: (obj: T) => boolean;
    maxAttempts: number;
    intervalMs: number;
    errorMapper: (error: ApiError<ErrorCodes>) => number;
  }
): Promise<T> {
  const { checkFn, maxAttempts, intervalMs, errorMapper } = options;

  // eslint-disable-next-line functional/no-let
  for (let attemptCount = 0; attemptCount < maxAttempts; attemptCount++) {
    try {
      const result = await fetchPromiseFactory();

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
        errorMapper,
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
  throw new Error(`Polling timed out after ${maxAttempts} attempts`);
}
