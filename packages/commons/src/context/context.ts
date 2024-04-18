/* eslint-disable functional/immutable-data */
import { zodiosContext } from "@zodios/express";
import { z } from "zod";
import { MakeApiProblemFn, makeApiProblemBuilder } from "pagopa-interop-models";
import { AuthData } from "../auth/authData.js";
import { Logger, logger } from "../logging/index.js";

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

export const loggerAndMakeApiProblemBuilder = <T extends string>(
  serviceName: string,
  appCtx: { authData: AuthData; correlationId?: string | null | undefined },
  errorsCodes: {
    [K in T]: string;
  }
): {
  logger: Logger;
  makeApiProblem: MakeApiProblemFn<T>;
} => {
  const loggerInstance = logger({ serviceName, ...appCtx });
  return {
    logger: loggerInstance,
    makeApiProblem: makeApiProblemBuilder(loggerInstance, errorsCodes),
  };
};
