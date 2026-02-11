import { constants } from "http2";
import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  badRequestError,
  genericError,
  makeApiProblemBuilder,
  parseErrorMessage,
} from "pagopa-interop-models";
import { fromZodIssue } from "zod-validation-error";
import { z } from "zod";
import { fromAppContext } from "../context/context.js";

const makeApiProblem = makeApiProblemBuilder({});

export async function fastifyErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = fromAppContext(request.ctx);
  ctx.logger.error(`Error in request: ${parseErrorMessage(error)}`);

  if (error.validation) {
    const zodIssues: z.ZodIssue[] = error.validation.map((v) => ({
      code: z.ZodIssueCode.custom,
      path: v.instancePath ? v.instancePath.split("/").filter(Boolean) : [],
      message: v.message ?? "Validation error",
    }));
    const detail = `Incorrect value for ${
      error.validationContext ?? "request"
    }`;
    const errors = zodIssues.map((e) => fromZodIssue(e));

    const problem = makeApiProblem(
      badRequestError(detail, errors),
      () => constants.HTTP_STATUS_BAD_REQUEST,
      ctx
    );
    await reply.status(problem.status).send(problem);
    return;
  }

  if (error instanceof SyntaxError) {
    const problem = makeApiProblem(
      badRequestError("Invalid request body"),
      () => constants.HTTP_STATUS_BAD_REQUEST,
      ctx
    );
    await reply.status(problem.status).send(problem);
    return;
  }

  const problem = makeApiProblem(
    genericError("Unexpected error"),
    () => constants.HTTP_STATUS_INTERNAL_SERVER_ERROR,
    ctx
  );
  await reply.status(problem.status).send(problem);
}
