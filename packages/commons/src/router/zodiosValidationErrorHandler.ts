import { constants } from "http2";
import express, { Response, NextFunction } from "express";
import { badRequestError, makeApiProblemBuilder } from "pagopa-interop-models";
import { z } from "zod";
import { fromZodIssue } from "zod-validation-error";
import { WithZodiosContext } from "@zodios/express";
import { ExpressContext, fromAppContext } from "../context/context.js";

const makeApiProblem = makeApiProblemBuilder({});

export function zodiosValidationErrorToApiProblem(
  zodError:
    | {
        context: string;
        error: z.ZodIssue[];
      }
    | SyntaxError,
  req: WithZodiosContext<express.Request, ExpressContext>,
  res: Response,
  _next: NextFunction
): Response {
  const ctx = fromAppContext(req.ctx);
  const { detail, errors } =
    zodError instanceof SyntaxError
      ? { detail: zodError.message, errors: [zodError] }
      : {
          detail: `Incorrect value for ${zodError.context}`,
          errors: zodError.error.map((e) => fromZodIssue(e)),
        };

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
