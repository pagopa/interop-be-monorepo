import { constants } from "http2";
import express, { Response, NextFunction } from "express";
import { badRequestError, makeApiProblemBuilder } from "pagopa-interop-models";
import { z } from "zod";
import { fromZodIssue } from "zod-validation-error";
import { WithZodiosContext } from "@zodios/express";
import { ExpressContext, fromAppContext } from "../index.js";

const makeApiProblem = makeApiProblemBuilder({
  errorCodes: {},
  codePrefix: undefined,
});

export function zodiosValidationErrorToApiProblem(
  zodError: {
    context: string;
    error: z.ZodIssue[];
  },
  req: WithZodiosContext<express.Request, ExpressContext>,
  res: Response,
  _next: NextFunction
): Response {
  const ctx = fromAppContext(req.ctx);
  const detail = `Incorrect value for ${zodError.context}`;
  const errors = zodError.error.map((e) => fromZodIssue(e));

  return res
    .status(constants.HTTP_STATUS_BAD_REQUEST)
    .send(
      makeApiProblem(
        badRequestError(detail, errors),
        () => constants.HTTP_STATUS_BAD_REQUEST,
        ctx.logger,
        ctx.correlationId
      )
    );
}
