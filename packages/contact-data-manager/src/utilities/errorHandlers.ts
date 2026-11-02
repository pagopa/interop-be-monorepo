import {
  errorsToApiProblemsMiddleware,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { badRequestError } from "pagopa-interop-models";

import { makeApiProblem } from "../model/errors.js";

// Validation errors may include fragments of the request.
export const contactValidationErrorToApiProblem: typeof zodiosValidationErrorToApiProblem =
  (_error, req, res, _next) => {
    const problem = makeApiProblem(
      badRequestError("Invalid request body"),
      () => 400,
      fromAppContext(req.ctx)
    );
    return res.status(problem.status).send(problem);
  };

// JSON parser errors can include fragments of the contact email.
export const contactErrorsToApiProblemsMiddleware: typeof errorsToApiProblemsMiddleware =
  (error, req, res, next) => {
    errorsToApiProblemsMiddleware(
      error instanceof SyntaxError
        ? new SyntaxError("Invalid request body")
        : error,
      req,
      res,
      next
    );
  };
