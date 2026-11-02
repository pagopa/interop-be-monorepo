import { errorsToApiProblemsMiddleware } from "pagopa-interop-commons";

// Any exception can include fragments of the contact email.
export const contactErrorsToApiProblemsMiddleware: typeof errorsToApiProblemsMiddleware =
  (error, req, res, next) => {
    errorsToApiProblemsMiddleware(
      error instanceof SyntaxError
        ? new SyntaxError("Invalid request body")
        : new Error("Contact request failed"),
      req,
      res,
      next
    );
  };
