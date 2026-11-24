import {
  errorsToApiProblemsMiddleware,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";

import { appBasePath } from "../config/appBasePath.js";

// Contact validation issues may include the submitted address.
export const tenantValidationErrorToApiProblem: typeof zodiosValidationErrorToApiProblem =
  (error, req, res, next) =>
    zodiosValidationErrorToApiProblem(
      req.route?.path === "/tenants/:tenantId/contact"
        ? { ...error, error: [] }
        : error,
      req,
      res,
      next
    );

// JSON parser errors can contain a fragment of the submitted address.
export const contactBodyErrorHandler: typeof errorsToApiProblemsMiddleware = (
  error,
  req,
  res,
  next
) =>
  errorsToApiProblemsMiddleware(
    error instanceof SyntaxError &&
      /^\/tenants\/[^/]+\/contact\/?$/i.test(req.path.slice(appBasePath.length))
      ? new SyntaxError("Invalid contact request body")
      : error,
    req,
    res,
    next
  );
