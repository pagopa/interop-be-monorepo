import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";

const attributeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(api.api);
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = userRoles;
  attributeRouter
    .get(
      "/attributes",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/attributes/name/:name",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/attributes/origin/:origin/code/:code",
      authorizationMiddleware([
        ADMIN_ROLE,
        INTERNAL_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/attributes/:attributeId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/bulk/attributes",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/certifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/declaredAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/verifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/internal/certifiedAttributes",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return attributeRouter;
};
export default attributeRouter;
