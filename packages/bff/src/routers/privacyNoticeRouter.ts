import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  authorizationMiddleware,
  userRoles,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";

const privacyNoticeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const privacyNoticeRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const {
    ADMIN_ROLE,
    // SECURITY_ROLE,
    // API_ROLE,
    // M2M_ROLE,
    // INTERNAL_ROLE,
    // SUPPORT_ROLE,
  } = userRoles;

  privacyNoticeRouter
    .get(
      "/user/consent/:consentType",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/user/consent/:consentType",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/privacyNotices/:consentType",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return privacyNoticeRouter;
};

export default privacyNoticeRouter;
