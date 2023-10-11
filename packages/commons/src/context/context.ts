/* eslint-disable functional/immutable-data */
import { AsyncLocalStorage } from "async_hooks";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AuthData } from "../auth/authData.js";
import { readHeaders } from "../auth/headers.js";

export const ctx = z.object({
  authData: AuthData,
  correlationId: z.string().uuid(),
});

export type AppContext = z.infer<typeof ctx>;

const globalStore = new AsyncLocalStorage<AppContext>();
const defaultAppContext: AppContext = {
  authData: {
    userId: "",
    organizationId: "",
    userRoles: [],
  },
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
  globalStore.run(defaultAppContext, () => getContext());
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
    context.authData = {
      userId: headers.userId,
      organizationId: headers.organizationId,
      userRoles: headers.userRoles,
    };

    context.correlationId = headers?.correlationId;
    next();
  }
};
