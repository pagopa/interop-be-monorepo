import { errorsToApiProblemsMiddleware } from "pagopa-interop-commons";

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
