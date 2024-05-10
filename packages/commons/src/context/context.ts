import {
  ZodiosRouterContextRequestHandler,
  zodiosContext,
} from "@zodios/express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { AuthData } from "../auth/authData.js";
import { Logger, logger } from "../logging/index.js";
import { readCorrelationIdHeader } from "../auth/headers.js";

export const AppContext = z.object({
  serviceName: z.string(),
  authData: AuthData,
  correlationId: z.string(),
});
export type AppContext = z.infer<typeof AppContext>;

export const zodiosCtx = zodiosContext(z.object({ ctx: AppContext }));
export type ZodiosContext = NonNullable<typeof zodiosCtx>;
export type ExpressContext = NonNullable<typeof zodiosCtx.context>;

export type WithLogger<T> = T & { logger: Logger };

export function fromAppContext(ctx: AppContext): WithLogger<AppContext> {
  return { ...ctx, logger: logger({ ...ctx }) };
}

export const contextMiddleware =
  (serviceName: string): ZodiosRouterContextRequestHandler<ExpressContext> =>
  (req, _res, next): void => {
    // eslint-disable-next-line functional/immutable-data
    req.ctx = {
      serviceName,
      correlationId: readCorrelationIdHeader(req) ?? uuidv4(),
    } as AppContext;

    next();
  };
