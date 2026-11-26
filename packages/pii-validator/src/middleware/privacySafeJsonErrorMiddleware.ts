import { WithZodiosContext } from "@zodios/express";
import express, { NextFunction, Response } from "express";
import { ExpressContext, fromAppContext } from "pagopa-interop-commons";

import { invalidRequestBody, makeApiProblem } from "../model/errors.js";
import { invalidRequestBodyErrorMapper } from "../utilities/errorMappers.js";

export function privacySafeJsonErrorMiddleware(
  error: unknown,
  req: WithZodiosContext<express.Request, ExpressContext>,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (!(error instanceof SyntaxError)) {
    next(error);
    return;
  }

  const ctx = fromAppContext(req.ctx);
  const problem = makeApiProblem(
    invalidRequestBody(),
    invalidRequestBodyErrorMapper,
    ctx
  );
  res.status(problem.status).send(problem);
}
