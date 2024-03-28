/* eslint-disable functional/immutable-data */
import { AsyncLocalStorage } from "async_hooks";
import { NextFunction, Request, Response } from "express";
import { zodiosContext } from "@zodios/express";
import { z } from "zod";
import { AuthData } from "../auth/authData.js";
import { readHeaders } from "../auth/headers.js";

export type AppContext = z.infer<typeof ctx>;
export type ZodiosContext = NonNullable<typeof zodiosCtx>;
export type ExpressContext = NonNullable<typeof zodiosCtx.context>;

export const ctx = z.object({
  authData: AuthData,
  correlationId: z.string().uuid(),
});

export const zodiosCtx = zodiosContext(z.object({ ctx }));

const globalStore = new AsyncLocalStorage<AppContext>();
const defaultAppContext: AppContext = {
  authData: { tokenType: "empty" },
  correlationId: "",
};

export const getContext = (): AppContext => {
  const context = globalStore.getStore();
  return !context ? defaultAppContext : context;
};

export const globalContextMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  globalStore.run(defaultAppContext, () => defaultAppContext);
  next();
};

export const contextDataMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const headers = readHeaders(req);
  if (headers) {
    const context = getContext();
    const { correlationId, ...authData } = headers;
    context.authData = authData;
    context.correlationId = correlationId;
  }
  next();
};
