import {
  errorsToApiProblemsMiddleware,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { badRequestError, genericError } from "pagopa-interop-models";

import { makeApiProblem } from "../model/errors.js";

// Validation and JSON parsing errors may include fragments of the request.
export const contactValidationErrorToApiProblem: typeof zodiosValidationErrorToApiProblem =
  (_error, req, res, _next) => {
    const problem = makeApiProblem(
      badRequestError("Invalid request body"),
      () => 400,
      fromAppContext(req.ctx)
    );
    return res.status(problem.status).send(problem);
  };

export const contactErrorsToApiProblemsMiddleware: typeof errorsToApiProblemsMiddleware =
  (error, req, res, next) => {
    errorsToApiProblemsMiddleware(
      error instanceof SyntaxError
        ? new SyntaxError("Invalid request body")
        : genericError("Unexpected error"),
      req,
      res,
      next
    );
  };
