import type { ErrorRequestHandler } from "express";

import { zodiosValidationErrorToApiProblem } from "pagopa-interop-commons";

// Contact validation issues may include the submitted address.
export const tenantValidationErrorToApiProblem: typeof zodiosValidationErrorToApiProblem =
  (error, req, res, next) =>
    zodiosValidationErrorToApiProblem(
      req.route?.path === "/tenants/:tenantId/contact" ||
        req.route?.path === "/tenants/:tenantId/mails"
        ? { ...error, error: [] }
        : error,
      req,
      res,
      next
    );

// Express strips the mount path. Only redact malformed bodies at the endpoint itself.
export const contactBodyErrorHandler: ErrorRequestHandler = (
  error,
  req,
  _res,
  next
) =>
  next(
    req.path === "/" && error instanceof SyntaxError
      ? new SyntaxError("Invalid contact request body")
      : error
  );
