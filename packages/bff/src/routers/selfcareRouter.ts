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

const selfcareRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const selfcareRouter = ctx.router(api.api, {
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

  selfcareRouter
    .get(
      "/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/selfcare/institutions/products",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/selfcare/institutions",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return selfcareRouter;
};

export default selfcareRouter;
