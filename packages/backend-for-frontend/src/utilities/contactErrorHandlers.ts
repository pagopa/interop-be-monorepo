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
