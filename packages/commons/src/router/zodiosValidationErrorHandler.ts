import { constants } from "http2";
import express, { Response, NextFunction } from "express";
import { badRequestError, makeApiProblemBuilder } from "pagopa-interop-models";
import { z } from "zod";
import { fromZodIssue } from "zod-validation-error";
import { WithZodiosContext } from "@zodios/express";
import { ExpressContext, logger } from "../index.js";

const makeApiProblem = makeApiProblemBuilder({});

export function zodiosValidationErrorToApiProblem(
  zodError: {
    context: string;
    error: z.ZodIssue[];
  },
  req: WithZodiosContext<express.Request, ExpressContext>,
  res: Response,
  _next: NextFunction
): void {
  const detail = `Incorrect value for ${zodError.context}`;
  const errors = zodError.error.map((e) => fromZodIssue(e));

  res
    .status(constants.HTTP_STATUS_BAD_REQUEST)
    .json(
      makeApiProblem(
        badRequestError(detail, errors),
        () => constants.HTTP_STATUS_BAD_REQUEST,
        logger({ ...req.ctx })
      )
    )
    .send();
}
