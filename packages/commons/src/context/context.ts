/* eslint-disable functional/immutable-data */
import { AsyncLocalStorage } from "async_hooks";
import { NextFunction, Request, Response } from "express";
import { zodiosContext } from "@zodios/express";
import { z } from "zod";
import { P, match } from "ts-pattern";
import { AuthData, defaultAuthData } from "../auth/authData.js";
import { readHeaders } from "../auth/headers.js";

export type AppContext = {
  authData: AuthData;
  messageData?: {
    eventType: string;
    eventVersion: number;
    streamId: string;
  };
  correlationId?: string | null | undefined;
};
export type ZodiosContext = NonNullable<typeof zodiosCtx>;
export type ExpressContext = NonNullable<typeof zodiosCtx.context>;

export const ctx = z.object({
  authData: AuthData,
  correlationId: z.string(),
});

export const zodiosCtx = zodiosContext(z.object({ ctx }));

const globalStore = new AsyncLocalStorage<AppContext>();
const defaultAppContext: AppContext = {
  authData: defaultAuthData,
};

// export const getContext = (): AppContext => {
//   const context = globalStore.getStore();
//   return !context ? defaultAppContext : context;
// };

export const contextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const headers = readHeaders(req);
  const context = match(headers)
    .with(P.not(P.nullish), (headers) => ({
      authData: {
        userId: headers.userId,
        organizationId: headers.organizationId,
        userRoles: headers.userRoles,
        externalId: headers.externalId,
      },
      correlationId: headers.correlationId,
    }))
    .with(P.nullish, () => defaultAppContext)
    .exhaustive();

  globalStore.run(context, () => next());
};

export function runWithContext(
  context: Partial<AppContext>,
  fn: () => void
): void {
  globalStore.run({ ...defaultAppContext, ...context }, fn);
}
