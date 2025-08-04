import { constants } from "http2";
import express, { Response, NextFunction } from "express";
import {
  badRequestError,
  makeApiProblemBuilder,
  parseErrorMessage,
} from "pagopa-interop-models";
import { z } from "zod";
import { fromZodIssue } from "zod-validation-error";
import { WithZodiosContext } from "@zodios/express";
import { ExpressContext, fromAppContext } from "../context/context.js";

const makeApiProblem = makeApiProblemBuilder({});

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
        ctx
      )
    );
}

export function errorsToApiProblemsMiddleware(
  error: SyntaxError,
  req: WithZodiosContext<express.Request, ExpressContext>,
  res: Response,
  _next: NextFunction
): Response {
  const ctx = fromAppContext(req.ctx);
  ctx.logger.error(`Error in request: ${parseErrorMessage(error)}`);

  if (error instanceof SyntaxError) {
    return res
      .status(constants.HTTP_STATUS_BAD_REQUEST)
      .send(
        makeApiProblem(
          badRequestError("Invalid request body"),
          () => constants.HTTP_STATUS_BAD_REQUEST,
          ctx
        )
      );
  }

  return res
    .status(constants.HTTP_STATUS_BAD_REQUEST)
    .send(
      makeApiProblem(
        badRequestError("Unexpected error"),
        () => constants.HTTP_STATUS_BAD_REQUEST,
        fromAppContext(req.ctx)
      )
    );
}
