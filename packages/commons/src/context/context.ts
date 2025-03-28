import { constants } from "http2";
import { randomUUID } from "crypto";
import {
  ZodiosRouterContextRequestHandler,
  zodiosContext,
} from "@zodios/express";
import { z } from "zod";
import {
  CorrelationId,
  makeApiProblemBuilder,
  missingHeader,
  unsafeBrandId,
} from "pagopa-interop-models";
import { AuthData } from "../auth/authData.js";
import { genericLogger, Logger, logger } from "../logging/index.js";
import { parseCorrelationIdHeader } from "../auth/headers.js";

export const AppContext = z.object({
  serviceName: z.string(),
  authData: AuthData,
  correlationId: CorrelationId,
  requestTimestamp: z.number(),
});
export type AppContext = z.infer<typeof AppContext>;

export const zodiosCtx = zodiosContext(z.object({ ctx: AppContext }));
export type ZodiosContext = NonNullable<typeof zodiosCtx>;
export type ExpressContext = NonNullable<typeof zodiosCtx.context>;

export type WithLogger<T> = T & { logger: Logger };

export function fromAppContext(ctx: AppContext): WithLogger<AppContext> {
  return { ...ctx, logger: logger({ ...ctx }) };
}

const makeApiProblem = makeApiProblemBuilder({});

export const contextMiddleware =
  (
    serviceName: string,
    readCorrelationIdFromHeader: boolean = true
  ): ZodiosRouterContextRequestHandler<ExpressContext> =>
  async (req, res, next): Promise<unknown> => {
    const setCtx = (correlationId: string): void => {
      // eslint-disable-next-line functional/immutable-data
      req.ctx = {
        serviceName,
        correlationId: unsafeBrandId<CorrelationId>(correlationId),
      } as AppContext;
    };

    if (readCorrelationIdFromHeader) {
      const correlationIdHeader = parseCorrelationIdHeader(req);

      if (!correlationIdHeader) {
        const problem = makeApiProblem(
          missingHeader("X-Correlation-Id"),
          () => constants.HTTP_STATUS_BAD_REQUEST,
          genericLogger,
          unsafeBrandId("MISSING")
        );
        return res.status(problem.status).send(problem);
      }

      setCtx(correlationIdHeader);
    } else {
      setCtx(randomUUID());
    }

    return next();
  };
