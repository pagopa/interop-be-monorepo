import {
  WithLogger,
  errorsToApiProblemsMiddleware,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";

import { appBasePath } from "../config/appBasePath.js";
import { makeApiProblem } from "../model/errors.js";
import { BffAppContext } from "./context.js";

// Downstream errors can contain request data. Preserve the HTTP mapping and
// log only the tenant and the outcome, with the request's correlation ID.
export function contactOperationProblem(
  error: unknown,
  ctx: WithLogger<BffAppContext>,
  tenantId: string
) {
  return makeApiProblem(error, emptyErrorMapper, {
    ...ctx,
    logger: {
      warn: () =>
        ctx.logger.warn(`Contact operation failed for tenant ${tenantId}`),
      error: () =>
        ctx.logger.error(
          `Contact operation unconfirmed for tenant ${tenantId}`
        ),
    },
  });
}

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
