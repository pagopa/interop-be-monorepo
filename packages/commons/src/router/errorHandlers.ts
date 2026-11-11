import { WithZodiosContext } from "@zodios/express";
import express, { Response, NextFunction } from "express";
import { constants } from "http2";
import {
  ApiError,
  badRequestError,
  contentTooLargeError,
  emptyErrorMapper,
  genericError,
  makeApiProblemBuilder,
  parseErrorMessage,
  unsupportedMediaTypeError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
import { fromZodIssue } from "zod-validation-error";

import { ExpressContext, fromAppContext } from "../context/context.js";

const makeApiProblem = makeApiProblemBuilder({});

const BodyParserClientError = z.object({
  status: z.number().int().min(400).max(499),
  expose: z.literal(true),
});

function toMalformedRequestError(
  error: unknown
): ApiError<unknown> | undefined {
  if (error instanceof ApiError && error.code === "badRequestError") {
    return error;
  }

  const bodyParserError = BodyParserClientError.safeParse(error);
  if (!bodyParserError.success) {
    return undefined;
  }

  return match(bodyParserError.data.status)
    .with(constants.HTTP_STATUS_PAYLOAD_TOO_LARGE, () =>
      contentTooLargeError("Request body too large")
    )
    .with(constants.HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE, () =>
      unsupportedMediaTypeError("Unsupported request body charset or encoding")
    )
    .otherwise(() => badRequestError("Invalid request body"));
}

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
  error: unknown,
  req: WithZodiosContext<express.Request, ExpressContext>,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const ctx = fromAppContext(req.ctx);

  const malformedRequestError = toMalformedRequestError(error);
  if (malformedRequestError) {
    const problem = makeApiProblem(
      malformedRequestError,
      emptyErrorMapper,
      ctx,
      `Malformed request: ${parseErrorMessage(error)}`
    );
    res.status(problem.status).send(problem);
    return;
  }

  ctx.logger.error(`Error in request: ${parseErrorMessage(error)}`);

  if (error instanceof SyntaxError) {
    res
      .status(constants.HTTP_STATUS_BAD_REQUEST)
      .send(
        makeApiProblem(
          badRequestError("Invalid request body"),
          () => constants.HTTP_STATUS_BAD_REQUEST,
          ctx
        )
      );
    return;
  }

  res
    .status(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .send(
      makeApiProblem(
        genericError("Unexpected error"),
        () => constants.HTTP_STATUS_INTERNAL_SERVER_ERROR,
        ctx
      )
    );
}
