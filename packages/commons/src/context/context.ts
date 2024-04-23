/* eslint-disable functional/immutable-data */
import { AsyncLocalStorage } from "async_hooks";
import { NextFunction, Request, Response } from "express";
import { zodiosContext } from "@zodios/express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { AuthData } from "../auth/authData.js";
import { readCorrelationIdHeader } from "../auth/headers.js";

export type AppContext = {
  authData?: AuthData;
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

export const getMutableContext = (): AppContext | undefined =>
  globalStore.getStore();

export const contextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void =>
  globalStore.run(
    {
      correlationId: readCorrelationIdHeader(req) ?? uuidv4(),
    },
    () => next()
  );

export async function runWithContext(
  context: AppContext,
  fn: () => Promise<void>
): Promise<void> {
  await globalStore.run(context, fn);
}
