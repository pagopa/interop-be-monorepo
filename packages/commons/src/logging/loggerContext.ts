/* eslint-disable functional/immutable-data */
import { AsyncLocalStorage } from "async_hooks";
import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AuthData } from "../auth/authData.js";
import { readCorrelationIdHeader } from "../auth/headers.js";

export type LoggerContext = {
  serviceName: string;
  authData?: AuthData;
  messageData?: {
    eventType: string;
    eventVersion: number;
    streamId: string;
  };
  correlationId?: string | null | undefined;
};

const loggerContextStore = new AsyncLocalStorage<LoggerContext>();

export const getMutableLoggerContext = (): LoggerContext | undefined =>
  loggerContextStore.getStore();

export const loggerContextMiddleware =
  (serviceName: string) =>
  (req: Request, _res: Response, next: NextFunction): void =>
    loggerContextStore.run(
      {
        serviceName,
        correlationId: readCorrelationIdHeader(req) ?? uuidv4(),
      },
      () => next()
    );

export async function runWithLoggerContext(
  loggerContext: LoggerContext,
  fn: () => Promise<void>
): Promise<void> {
  await loggerContextStore.run(loggerContext, fn);
}
