import { constants } from "http2";
import { Request, Response, NextFunction } from "express";
import { badRequestError, makeApiProblemBuilder } from "pagopa-interop-models";
import { z } from "zod";
import { fromZodIssue } from "zod-validation-error";
import { logger } from "../logging/index.js";

const makeApiProblem = makeApiProblemBuilder(logger, {});

export function zodiosValidationErrorToApiProblem(
  zodError: {
    context: string;
    error: z.ZodIssue[];
  },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const details = `${zodError.context} = ${zodError.error
    .map((e) => fromZodIssue(e))
    .join(", ")}`;

  res
    .status(constants.HTTP_STATUS_BAD_REQUEST)
    .json(
      makeApiProblem(
        badRequestError(details),
        () => constants.HTTP_STATUS_BAD_REQUEST
      )
    )
    .send();
}
